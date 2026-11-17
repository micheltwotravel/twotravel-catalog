// api/ticket-notify.js — Email notification when a ticket changes status
// Uses Resend (resend.com) — set RESEND_API_KEY in environment variables

const TEAM_EMAILS = {
  michel:    "michel@two.travel",
  caro:      "caro@two.travel",
  ray:       "ray@two.travel",
  giulia:    "giulia@two.travel",
  sebastian: "sebastian@two.travel",
  armando:   "armando@two.travel",
  patricia:  "patricia@two.travel",
  lyna:      "lyna@two.travel",
  julith:    "julith@two.travel",
  laura:     "laura@two.travel",
};

const STATUS_LABELS = {
  pendiente:   "⏳ Pendiente",
  en_progreso: "🔄 En Progreso",
  listo:       "✅ Listo",
  cancelado:   "❌ Cancelado",
};

const PRIORITY_LABELS = {
  alta:  "🔴 Alta",
  media: "🟡 Media",
  baja:  "🟢 Baja",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured" });

  const { ticket, newStatus, movedBy } = req.body;
  if (!ticket || !newStatus) return res.status(400).json({ error: "Missing ticket or newStatus" });

  const assignees = (ticket.assigned_to || "").split(",").map(s => s.trim()).filter(Boolean);
  const emails = assignees.map(a => TEAM_EMAILS[a]).filter(Boolean);

  if (emails.length === 0) return res.status(200).json({ sent: 0, reason: "no assignees with known emails" });

  const statusLabel   = STATUS_LABELS[newStatus] || newStatus;
  const priorityLabel = PRIORITY_LABELS[ticket.priority] || ticket.priority;
  const pageLabel     = ticket.page || "Compass";
  const ticketUrl     = `https://twotravelvip.com/?mode=tickets`;
  const shortId       = ticket.id ? "#" + ticket.id.slice(-4) : "";

  const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
  <div style="background: #111827; padding: 20px 24px; border-radius: 12px 12px 0 0;">
    <span style="color: #9ca3af; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;">Two Travel · Compass</span>
    <h1 style="color: #fff; margin: 6px 0 0; font-size: 18px; font-weight: 700;">Ticket actualizado ${shortId}</h1>
  </div>
  <div style="background: #f9fafb; padding: 20px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #111827;">${ticket.title}</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr>
        <td style="padding: 6px 0; font-size: 12px; color: #6b7280; width: 110px;">Estado nuevo</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #111827;">${statusLabel}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-size: 12px; color: #6b7280;">Prioridad</td>
        <td style="padding: 6px 0; font-size: 13px; color: #111827;">${priorityLabel}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-size: 12px; color: #6b7280;">Área</td>
        <td style="padding: 6px 0; font-size: 13px; color: #111827;">${pageLabel}</td>
      </tr>
      ${movedBy ? `<tr><td style="padding: 6px 0; font-size: 12px; color: #6b7280;">Movido por</td><td style="padding: 6px 0; font-size: 13px; color: #111827;">${movedBy}</td></tr>` : ""}
    </table>
    ${ticket.description ? `<p style="margin: 0 0 16px; font-size: 13px; color: #6b7280; line-height: 1.6; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px;">${ticket.description}</p>` : ""}
    <a href="${ticketUrl}" style="display: inline-block; background: #111827; color: #fff; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Ver en Compass →</a>
    <p style="margin: 20px 0 0; font-size: 11px; color: #9ca3af;">Two Travel · Compass Tickets</p>
  </div>
</div>`;

  const results = await Promise.allSettled(emails.map(to =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Compass <compass@two.travel>",
        to,
        subject: `${statusLabel} — ${ticket.title} ${shortId}`,
        html,
      }),
    }).then(r => r.json())
  ));

  const sent = results.filter(r => r.status === "fulfilled").length;
  return res.status(200).json({ sent, total: emails.length });
}
