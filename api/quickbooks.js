// QuickBooks Online API — create estimates, refresh tokens
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const QB_BASE = "https://quickbooks.api.intuit.com/v3/company";

async function getTokens() {
  const sb = createClient(SB_URL, SB_KEY);
  const { data } = await sb.from("kickoffs").select("data").eq("id", "qb_tokens_v1").single();
  if (!data?.data) throw new Error("QB not connected — visit /api/qb-oauth first");
  return data.data;
}

async function refreshIfNeeded(stored) {
  if (Date.now() < (stored.expires_at || 0) - 60_000) return stored.access_token;

  const basic = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.refresh_token }),
  });
  const tokens = await r.json();
  if (!r.ok) throw new Error(`Token refresh failed: ${JSON.stringify(tokens)}`);

  const sb = createClient(SB_URL, SB_KEY);
  const updated = {
    ...stored,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || stored.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  await sb.from("kickoffs").update({ data: updated }).eq("id", "qb_tokens_v1");
  return updated.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, ...body } = req.body || {};

  try {
    const stored = await getTokens();
    const token  = await refreshIfNeeded(stored);
    const { realm_id } = stored;

    if (action === "status") {
      return res.json({ connected: true, realm_id, connected_at: stored.connected_at });
    }

    if (action === "create_estimate") {
      // body: { customerName, customerEmail, items: [{description, qty, unitPrice, qbCode}] }
      const { customerName, customerEmail, items = [], currency = "USD", memo = "" } = body;

      // QB requires ItemRef on every SalesItemLineDetail.
      // Find or create a QB Item for each unique qbCode, then cache the Id.
      // QB fetch with retry on 429 ThrottleExceeded (exponential backoff)
      async function qbFetch(url, opts = {}, retries = 3) {
        for (let attempt = 0; attempt <= retries; attempt++) {
          const r = await fetch(url, opts);
          if (r.status !== 429) return r;
          if (attempt === retries) return r;
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
        }
      }

      const itemRefCache = {};
      let incomeAcctIdCache = null;
      async function resolveItemRef(qbCode) {
        if (itemRefCache[qbCode]) return itemRefCache[qbCode];
        // Search by name
        const sq = await qbFetch(
          `${QB_BASE}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Item WHERE Name = '${qbCode.replace(/'/g,"\\'")}'`)}&minorversion=65`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
        );
        const sj = await sq.json();
        let itemId = sj?.QueryResponse?.Item?.[0]?.Id;
        // Create if not found
        if (!itemId) {
          // Query Income account once and cache
          if (!incomeAcctIdCache) {
            const aq = await qbFetch(
              `${QB_BASE}/${realm_id}/query?query=${encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 1")}&minorversion=65`,
              { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
            );
            const aj = await aq.json();
            incomeAcctIdCache = aj?.QueryResponse?.Account?.[0]?.Id || "1";
          }
          const cr = await qbFetch(`${QB_BASE}/${realm_id}/item?minorversion=65`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ Name: qbCode, Type: "Service", IncomeAccountRef: { value: incomeAcctIdCache } }),
          });
          const cj = await cr.json();
          itemId = cj?.Item?.Id;
          if (!itemId) throw new Error(`Could not create QB item "${qbCode}": ${JSON.stringify(cj)}`);
        }
        itemRefCache[qbCode] = { value: itemId, name: qbCode };
        return itemRefCache[qbCode];
      }

      // Build line items — resolve ItemRef sequentially to avoid QB rate limiting
      const Line = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemRef = await resolveItemRef(it.qbCode);
        Line.push({
          LineNum:     i + 1,
          Amount:      parseFloat(it.unitPrice || 0) * parseFloat(it.qty || 1),
          DetailType:  "SalesItemLineDetail",
          Description: it.description,
          SalesItemLineDetail: {
            ItemRef:   itemRef,
            Qty:       parseFloat(it.qty || 1),
            UnitPrice: parseFloat(it.unitPrice || 0),
          },
        });
      }

      // Find or create customer by name
      const searchRes = await fetch(
        `${QB_BASE}/${realm_id}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customerName.replace(/'/g, "\\'")}'`)}&minorversion=65`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const searchJson = await searchRes.json();
      let customerId = searchJson?.QueryResponse?.Customer?.[0]?.Id;

      // Create customer if not found
      if (!customerId) {
        const custRes = await fetch(`${QB_BASE}/${realm_id}/customer?minorversion=65`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            DisplayName: customerName,
            PrimaryEmailAddr: customerEmail ? { Address: customerEmail } : undefined,
          }),
        });
        const custJson = await custRes.json();
        customerId = custJson?.Customer?.Id;
        if (!customerId) throw new Error(`Could not create customer: ${JSON.stringify(custJson)}`);
      }

      // Create the estimate
      const estBody = {
        Line,
        CustomerRef: { value: customerId },
        CurrencyRef: { value: currency },
        ...(memo ? { CustomerMemo: { value: memo } } : {}),
      };

      const estRes = await fetch(`${QB_BASE}/${realm_id}/estimate?minorversion=65`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(estBody),
      });
      const estJson = await estRes.json();
      if (!estRes.ok) throw new Error(`QB estimate error: ${JSON.stringify(estJson)}`);

      const est = estJson?.Estimate;
      return res.json({
        ok: true,
        estimateId: est?.Id,
        estimateNum: est?.DocNumber,
        totalAmt: est?.TotalAmt,
        // Deep link to QB Online estimate
        qbUrl: `https://app.qbo.intuit.com/app/estimate?txnId=${est?.Id}`,
      });
    }

    // ── CREATE JOURNAL ENTRY (Colombia commissions) ───────────────────────
    if (action === "create_journal_entry") {
      const {
        amount,              // base commission amount (before IVA)
        currency = "COP",
        fecha,               // ISO date YYYY-MM-DD
        clientName = "",
        vendorName = "",
        ciudad = "",         // MDE, CTG, BOG, etc. → QB Class
        retencionRate = 0.10,// retención de renta (default 10%)
        ivaRate = 0.19,      // IVA rate (default 19%)
        bankAccount = "Corriente 0250", // partial name to search Bancolombia COP account
      } = body;

      const base    = Math.round(parseFloat(amount));
      const iva     = Math.round(base * ivaRate);
      const ret     = Math.round(base * retencionRate);
      const netBank = base + iva - ret;

      // Find QB account by partial FullyQualifiedName
      async function findAccount(partial) {
        const q = `SELECT * FROM Account WHERE FullyQualifiedName LIKE '%${partial.replace(/'/g,"\\'")}%' MAXRESULTS 1`;
        const r = await fetch(
          `${QB_BASE}/${realm_id}/query?query=${encodeURIComponent(q)}&minorversion=65`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
        );
        const j = await r.json();
        const acc = j?.QueryResponse?.Account?.[0];
        if (!acc) throw new Error(`QB account not found: "${partial}"`);
        return { value: acc.Id, name: acc.FullyQualifiedName };
      }

      const [incomeAcc, ivaAcc, retAcc, bankAcc] = await Promise.all([
        findAccount("Concierge Commission"),
        findAccount("IVA 19%"),
        findAccount("Retenciones Practicadas"),
        findAccount(bankAccount),
      ]);

      const memo = `Comisión ${vendorName}${clientName ? " — " + clientName : ""}`;

      const journalEntry = {
        TxnDate: fecha || new Date().toISOString().slice(0, 10),
        CurrencyRef: { value: currency },
        ...(memo ? { PrivateNote: memo } : {}),
        Line: [
          {
            DetailType: "JournalEntryLineDetail",
            Amount: base,
            Description: memo,
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: incomeAcc,
              ...(ciudad ? { ClassRef: { name: ciudad } } : {}),
              ...(clientName ? { Entity: { Type: "Customer", EntityRef: { name: clientName } } } : {}),
            },
          },
          {
            DetailType: "JournalEntryLineDetail",
            Amount: iva,
            Description: `IVA 19% sobre comisión`,
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: ivaAcc,
            },
          },
          {
            DetailType: "JournalEntryLineDetail",
            Amount: ret,
            Description: `Retención renta ${Math.round(retencionRate * 100)}%`,
            JournalEntryLineDetail: {
              PostingType: "Debit",
              AccountRef: retAcc,
            },
          },
          {
            DetailType: "JournalEntryLineDetail",
            Amount: netBank,
            Description: `Pago neto recibido`,
            JournalEntryLineDetail: {
              PostingType: "Debit",
              AccountRef: bankAcc,
            },
          },
        ],
      };

      const jeRes = await fetch(`${QB_BASE}/${realm_id}/journalentry?minorversion=65`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(journalEntry),
      });
      const jeJson = await jeRes.json();
      if (!jeRes.ok) throw new Error(`QB JE error: ${JSON.stringify(jeJson)}`);

      const je = jeJson?.JournalEntry;
      return res.json({
        ok: true,
        jeId: je?.Id,
        jeNum: je?.DocNumber,
        base, iva, ret, netBank,
        qbUrl: `https://app.qbo.intuit.com/app/journal?txnId=${je?.Id}`,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (e) {
    console.error("QB error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
