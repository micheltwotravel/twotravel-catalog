// api/notion.js — Notion integration for Two Travel Sales Agent
// Vercel serverless function
// Actions: log_conversation, create_client, update_client, get_clients

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionRequest(path, method = "GET", body = null, token) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${NOTION_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// Helper: plain text → Notion rich text
function rt(text) {
  return [{ type: "text", text: { content: String(text || "").slice(0, 2000) } }];
}

// Helper: title property
function title(text) {
  return { title: [{ type: "text", text: { content: String(text || "").slice(0, 2000) } }] };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (process.env.NOTION_TOKEN || "").trim();
  const conversationsDb = (process.env.NOTION_CONVERSATIONS_DB || "").trim();
  const clientsDb = (process.env.NOTION_CLIENTS_DB || "").trim();

  if (!token) {
    return res.status(503).json({ error: "NOTION_TOKEN not configured", demo: true });
  }

  const { action, data } = req.body;

  // ── PING (connectivity check) ──────────────────────────────
  if (action === "ping") {
    return res.status(200).json({ ok: true, token: !!token, conversationsDb: !!conversationsDb });
  }

  try {
    // ── LOG CONVERSATION ───────────────────────────────────────
    if (action === "log_conversation") {
      if (!conversationsDb) return res.status(503).json({ error: "NOTION_CONVERSATIONS_DB not configured" });

      const { clientName, agentName, messages, summary, destination, status, timestamp } = data;

      // Format conversation as text
      const convoText = (messages || [])
        .map(m => `[${m.role === "user" ? clientName || "Client" : agentName || "Agent"}]: ${m.content}`)
        .join("\n\n")
        .slice(0, 2000);

      const properties = {
        "Name": title(`${clientName || "Unknown"} — ${new Date(timestamp || Date.now()).toLocaleDateString("es-CO")}`),
        "Client": { rich_text: rt(clientName || "") },
        "Agent": { rich_text: rt(agentName || "") },
        "Destination": { rich_text: rt(destination || "") },
        "Status": { select: { name: status || "New" } },
        "Summary": { rich_text: rt(summary || "") },
        "Date": { date: { start: new Date(timestamp || Date.now()).toISOString() } },
      };

      const r = await notionRequest("/pages", "POST", {
        parent: { database_id: conversationsDb },
        properties,
        children: convoText ? [{
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: convoText } }] },
        }] : [],
      }, token);

      if (!r.ok) console.error("[Notion] log_conversation error:", JSON.stringify(r.data).slice(0, 500));
      return res.status(200).json({ action: "conversation_logged", pageId: r.data?.id, ok: r.ok, error: r.ok ? undefined : r.data });
    }

    // ── CREATE / UPDATE CLIENT ─────────────────────────────────
    if (action === "create_client" || action === "update_client") {
      if (!clientsDb) return res.status(503).json({ error: "NOTION_CLIENTS_DB not configured" });

      const { name, email, phone, destination, status, agent, notes, pageId } = data;
      if (!name && !pageId) return res.status(400).json({ error: "name or pageId required" });

      const properties = {
        ...(name && { "Name": title(name) }),
        ...(email && { "Email": { email } }),
        ...(phone && { "Phone": { phone_number: phone } }),
        ...(destination && { "Destination": { rich_text: rt(destination) } }),
        ...(status && { "Status": { select: { name: status } } }),
        ...(agent && { "Agent": { rich_text: rt(agent) } }),
        ...(notes && { "Notes": { rich_text: rt(notes) } }),
      };

      if (action === "update_client" && pageId) {
        const r = await notionRequest(`/pages/${pageId}`, "PATCH", { properties }, token);
        return res.status(200).json({ action: "updated", pageId: r.data?.id, ok: r.ok });
      } else {
        const r = await notionRequest("/pages", "POST", {
          parent: { database_id: clientsDb },
          properties,
        }, token);
        return res.status(200).json({ action: "created", pageId: r.data?.id, ok: r.ok });
      }
    }

    // ── GET CLIENTS ────────────────────────────────────────────
    if (action === "get_clients") {
      if (!clientsDb) return res.status(503).json({ error: "NOTION_CLIENTS_DB not configured" });

      const { agentFilter, statusFilter } = data || {};
      const filters = [];

      if (agentFilter) {
        filters.push({ property: "Agent", rich_text: { contains: agentFilter } });
      }
      if (statusFilter) {
        filters.push({ property: "Status", select: { equals: statusFilter } });
      }

      const body = {
        page_size: 100,
        sorts: [{ property: "Name", direction: "ascending" }],
        ...(filters.length > 0 && {
          filter: filters.length === 1 ? filters[0] : { and: filters },
        }),
      };

      const r = await notionRequest(`/databases/${clientsDb}/query`, "POST", body, token);
      const clients = (r.data?.results || []).map(page => ({
        pageId: page.id,
        name: page.properties?.Name?.title?.[0]?.text?.content || "Unknown",
        email: page.properties?.Email?.email || "",
        phone: page.properties?.Phone?.phone_number || "",
        destination: page.properties?.Destination?.rich_text?.[0]?.text?.content || "",
        status: page.properties?.Status?.select?.name || "New",
        agent: page.properties?.Agent?.rich_text?.[0]?.text?.content || "",
        notes: page.properties?.Notes?.rich_text?.[0]?.text?.content || "",
      }));

      return res.status(200).json({ clients });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error("Notion handler error:", err);
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
