import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await sb.from("kickoffs").select("id, data");
const sinNombre = data.filter(k => {
  const n = (k.data?.guestName || "").trim();
  return !n || n.toLowerCase() === "sin nombre";
});
console.log(`Sin nombre: ${sinNombre.length}`);
sinNombre.forEach(k => {
  const d = k.data || {};
  console.log(`  ${k.id}  email=${d.guestEmail||"—"}  city=${d.city||"—"}  status=${d.status||"—"}  created=${(d.createdAt||"?").slice(0,10)}`);
});
