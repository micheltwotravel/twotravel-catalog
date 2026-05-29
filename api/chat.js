// api/chat.js — Anthropic Claude proxy for Two Travel Sales Agent
// Vercel serverless function

const SYSTEM_PROMPT = `You are an elite luxury travel sales assistant for Two Travel, a premium concierge travel company based in Colombia. You are bilingual (English/Spanish) but DEFAULT TO SPANISH — only switch to English if the client writes to you in English first.

YOUR PERSONA:
- Expert in luxury villas, yachts, and exclusive venues across Cartagena, Medellín, Tulum, and Mexico City
- Warm, professional, high-end tone — like a personal concierge at a 5-star hotel
- You know every property in the portfolio by heart
- You ask smart qualifying questions (group size, dates, budget, occasion, preferences)
- You always suggest 2–3 concrete options with specific names and prices

CRITICAL RULES — NEVER BREAK THESE:
1. NEVER say you are an AI, a language model, a chatbot, or any kind of automated system. You are a human sales advisor at Two Travel.
2. NEVER say you "don't have real data", "can't access live inventory", or "don't have a link". You always have information about the portfolio.
3. NEVER break character. If someone asks "are you a robot?" or "are you AI?", respond naturally: "No, soy del equipo de asesores de Two Travel! ¿En qué te ayudo?"
4. NEVER mention Notion, HubSpot, databases, APIs, or any internal tools. These do not exist to the client.
5. SIEMPRE usa el tool check_availability cuando el cliente pregunta disponibilidad para fechas específicas. NUNCA digas "te confirmo con el equipo" sin antes llamar el tool. El tool te da datos REALES en vivo de Airbnb.
6. SIEMPRE usa search_properties cuando busques detalles de propiedades, capacidad o precios. No dependas solo de tu memoria.
7. Para links al sitio web, siempre dirigir a: https://two.travel
8. Tienes datos reales y actuales — vienen de tus tools. Úsalos siempre.

TOOL USAGE RULES:
- Client asks "is X available for [dates]?" → CALL check_availability immediately
- Client asks about properties, villas, boats → CALL search_properties first
- Agent asks "show me my clients/deals" → CALL get_my_deals
- After getting tool results, present them naturally without mentioning the tool

TWO TRAVEL PORTFOLIO HIGHLIGHTS:

VILLAS — CARTAGENA (60+ properties):
- Villa Kosmopolita: 10 pax, Bocagrande, pool + rooftop, $2,200/night USD, bachelor-friendly ⭐⭐⭐⭐⭐
- Casa Aqua: 12 pax, Manga, private dock, $2,800/night, ideal for groups
- Villa Azul Cielo: 8 pax, Castillogrande, ocean view, $1,800/night, romantic
- Casa Porto: 16 pax, El Cabrero, colonial style, $3,500/night, events OK
- Villa Fantasía: 20 pax, Bocagrande, 2 pools, $4,200/night, parties/events

VILLAS — MEDELLÍN (18+ properties):
- Casa El Tesoro: 14 pax, El Tesoro, city view, $1,200/night, bachelor ✓
- Villa Las Palmas: 10 pax, Las Palmas, infinity pool, $1,400/night ⭐⭐⭐⭐⭐
- Casa Provenza: 8 pax, El Poblado, boutique style, $980/night, couples/small groups
- Villa Oasis Medellín: 18 pax, Envigado, party-friendly, $1,800/night

VILLAS — TULUM (9+ properties):
- Casa Selva: 8 pax, Aldea Zamá, jungle + pool, $1,600/night USD
- Villa Cenote: 10 pax, near cenote, $2,100/night, wellness retreats
- Casa Papaya: 6 pax, La Veleta, boutique, $1,200/night, honeymoon ideal

BOATS — CARTAGENA (80+ vessels):
Speedboats (day charters):
- Charlie: 20 pax, $600 USD/day, most popular for beach days
- Marlin II: 25 pax, $750/day, includes snorkel gear
- Blue Shark: 30 pax, $900/day, party setup available

Yachts (overnight / multi-day):
- Sea Land: 30 pax, 70ft, $3,500/day, premium catering included
- Pacific Star: 20 pax, 55ft, $2,800/day

Catamarans (ideal for large groups):
- Valhala: 35 pax, $3,000/day ⭐ Most requested
- Sea Wolf: 35 pax, $3,000/day, twin to Valhala
- La Paloma: 28 pax, $2,400/day

WEDDING & EVENT VENUES — CARTAGENA (41 venues):
- Casa 1537: 150 guests, historic Old City mansion, $8,000+ events
- Casa Pestagua: 200 guests, boutique hotel, $12,000+ full buyout
- Teatro Heredia: 500 guests, iconic theater, gala events
- Charleston Santa Teresa: 200 guests, 5-star hotel, $15,000+ buyout
- Club de Pesca: waterfront, 180 guests, sunset ceremonies

PRICING PHILOSOPHY:
- All prices in USD unless client is local (then COP)
- Packages always available: villa + boat + catering bundles save 10–15%
- Commission tiers: Standard (15%), Premium (20%), Elite (25%) for top properties

SALES APPROACH:
1. Greet warmly, ask about the occasion and group
2. Qualify: dates, group size, budget range, vibe (party/romantic/family/corporate)
3. Present 2–3 tailored options with specific property names and prices
4. Offer to build a full package (villa + boat + activities)
5. Capture contact info and next steps
6. Always end with a clear call to action ("¿Te envío una cotización formal?" / "Shall I send you a formal quote?")

IMPORTANT: Never make up properties that don't exist. If you don't have a specific property matching their needs exactly, offer the closest match and note you can check availability.`;

// ── Tools ─────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "check_availability",
    description: `Check REAL-TIME availability and pricing for Two Travel properties using the live Airbnb calendar.
Use this tool when a client asks:
- "Is [property] available for [dates]?"
- "What's the price for [dates]?"
- "Do you have anything available [month/dates]?"
- Any availability or live pricing question

The tool runs an automated check against Airbnb's real calendar and returns live data.
Results will be written back to our Notion database automatically.`,
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City to check: cartagena | medellin | tulum | mexico_city",
        },
        type: {
          type: "string",
          description: "Property type: villa | yacht | speedboat",
        },
        checkIn: {
          type: "string",
          description: "Check-in date in YYYY-MM-DD format",
        },
        checkOut: {
          type: "string",
          description: "Check-out date in YYYY-MM-DD format",
        },
        guests: {
          type: "number",
          description: "Number of guests",
        },
      },
      required: [],
    },
  },
  {
    name: "get_my_deals",
    description: `Fetch active HubSpot CRM deals (clients) for the current sales agent.
Use this tool when the agent (Ray, Ross, etc.) asks things like:
- "Show me my clients"
- "What deals do I have open?"
- "Who are my hot leads?"
- "What's my pipeline?"
- "¿Cuáles son mis clientes?" / "¿Qué oportunidades tengo?"

Returns a list of deals filtered by the agent's owner ID. Always call with the agentName from the system context.`,
    input_schema: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description: "Agent's first name (ray, ross, etc.) to filter deals by owner",
        },
        limit: {
          type: "number",
          description: "Max deals to return (default 50)",
        },
      },
      required: ["agentName"],
    },
  },
  {
    name: "search_properties",
    description: `Search the Two Travel live property database (Notion) to find villas, boats, yachts, catamarans, speedboats, or wedding venues.
Call this tool whenever a client asks about:
- Specific properties, availability, pricing, or capacity
- Recommendations based on group size, city, or occasion
- Party/bachelor friendliness
- Any property detail you're not 100% sure about

CITIES: cartagena, medellin, tulum, mexico_city
TYPES: villa, yacht, speedboat, wedding_venue, boat (returns all boat types)`,
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City: cartagena | medellin | tulum | mexico_city. Omit for all cities.",
        },
        type: {
          type: "string",
          description: "Property type: villa | yacht | speedboat | boat | wedding_venue. Omit for all types.",
        },
        maxPax: {
          type: "number",
          description: "Minimum capacity needed (number of guests).",
        },
        partyFriendly: {
          type: "boolean",
          description: "Set true to filter only party/bachelor-friendly properties.",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 5, max 10).",
        },
      },
      required: [],
    },
  },
];

// ── Call the internal properties API ─────────────────────────────────────────
async function fetchProperties(params) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const r = await fetch(`${base}/api/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", ...params }),
    });

    if (!r.ok) {
      console.error("Properties API error:", r.status);
      return null;
    }
    return await r.json();
  } catch (err) {
    console.error("fetchProperties error:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured", demo: true });
  }

  const { messages, clientContext } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  // Build system prompt with client/agent context if provided
  let system = SYSTEM_PROMPT;
  if (clientContext) {
    system += `\n\nCURRENT CLIENT CONTEXT:\n${JSON.stringify(clientContext, null, 2)}`;
  }
  // Inject agent identity so Claude can filter HubSpot deals correctly
  const agentName = req.body.agentName || clientContext?.agentName || null;
  if (agentName) {
    system += `\n\nYOU ARE ASSISTING AGENT: ${agentName}\nWhen the agent asks about their clients or deals, call get_my_deals with agentName="${agentName}".`;
  }

  try {
    // ── Agentic loop: handles tool calls from Claude ───────────────────────
    let currentMessages = [...messages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 2048,
          system,
          tools: TOOLS,
          messages: currentMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Anthropic error:", err);
        return res.status(response.status).json({ error: "Anthropic API error", details: err });
      }

      const data = await response.json();
      totalInputTokens  += data.usage?.input_tokens  || 0;
      totalOutputTokens += data.usage?.output_tokens || 0;

      // ── No tool call → return final text ─────────────────────────────────
      if (data.stop_reason !== "tool_use") {
        const text = data.content?.find(b => b.type === "text")?.text || "";
        return res.status(200).json({
          text,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        });
      }

      // ── Tool call → execute and continue ─────────────────────────────────
      const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
      const toolResults = [];

      for (const toolCall of toolUseBlocks) {
        console.log(`Tool call: ${toolCall.name}`, JSON.stringify(toolCall.input));

        if (toolCall.name === "get_my_deals") {
          try {
            const base = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000";

            const r = await fetch(`${base}/api/hubspot`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "get_contacts",
                data: {
                  agentName: toolCall.input.agentName,
                  limit: toolCall.input.limit || 50,
                },
              }),
            });

            const hsData = await r.json();
            const deals = hsData.contacts || [];
            const ownerFound = hsData.ownerFound;

            if (!deals.length) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: ownerFound
                  ? `No active deals found for ${toolCall.input.agentName}.`
                  : `Could not identify owner ID for "${toolCall.input.agentName}". Showing all deals instead. Deals: ${JSON.stringify(deals.slice(0, 10))}`,
              });
            } else {
              // Format deals as a readable summary
              const summary = deals.map(d => {
                const p = d.properties || {};
                const stage = p.dealstage || "unknown";
                const amount = p.amount ? `$${Number(p.amount).toLocaleString()}` : "no amount";
                const modified = p.lastmodifieddate ? new Date(p.lastmodifieddate).toLocaleDateString("es-CO") : "?";
                return `• ${p.dealname || "Unnamed"} | ${stage} | ${amount} | Updated: ${modified}`;
              }).join("\n");

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: `${ownerFound ? `Deals for ${toolCall.input.agentName}` : "All deals (owner not filtered)"} (${deals.length} total):\n\n${summary}`,
              });
            }
          } catch (err) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `HubSpot unavailable: ${err.message}. Please check manually.`,
            });
          }

        } else if (toolCall.name === "search_properties") {
          const result = await fetchProperties(toolCall.input);
          const content = result
            ? result.formatted || `Found ${result.count} properties.`
            : "No properties found. Use your portfolio knowledge to assist the client.";

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content,
          });

        } else if (toolCall.name === "check_availability") {
          // Trigger Apify actor and WAIT for results (up to 50s)
          try {
            const apifyToken = process.env.APIFY_TOKEN;
            const actorId    = process.env.APIFY_ACTOR_ID;

            if (!apifyToken || !actorId) {
              toolResults.push({ type: "tool_result", tool_use_id: toolCall.id,
                content: "Availability check not configured. Tell the client you'll confirm manually today." });
              continue;
            }

            // Build minimal property list from input or Notion
            const base = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000";

            const triggerRes = await fetch(`${base}/api/apify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "check", ...toolCall.input }),
            });
            const triggerData = await triggerRes.json();

            if (triggerData.error || !triggerData.runId) {
              toolResults.push({ type: "tool_result", tool_use_id: toolCall.id,
                content: `Could not start availability check: ${triggerData.error || "unknown error"}. Tell the client you'll confirm today.` });
              continue;
            }

            // Poll for result — max 45 seconds
            const runId = triggerData.runId;
            let results = null;
            for (let attempt = 0; attempt < 9; attempt++) {
              await new Promise(r => setTimeout(r, 5000));
              try {
                const statusRes = await fetch(
                  `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
                );
                const runInfo = await statusRes.json();
                const status = runInfo.data?.status;

                if (status === "SUCCEEDED") {
                  const datasetId = runInfo.data.defaultDatasetId;
                  const itemsRes = await fetch(
                    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${apifyToken}`
                  );
                  results = await itemsRes.json();
                  break;
                } else if (status === "FAILED" || status === "ABORTED") {
                  break;
                }
              } catch { /* keep polling */ }
            }

            let content;
            if (results && results.length > 0) {
              // Format results for Claude
              const lines = results.map(p => {
                const avail = p.available ? "✅ AVAILABLE" : "❌ NOT AVAILABLE";
                const price = p.pricePerNight ? `$${p.pricePerNight}/night (total $${p.totalPrice})` : "price not found";
                return `• ${p.name}: ${avail} | ${price} | Dates: ${p.checkIn} → ${p.checkOut}`;
              }).join("\n");
              content = `LIVE AVAILABILITY RESULTS for ${toolCall.input.checkIn || "?"} → ${toolCall.input.checkOut || "?"}:\n\n${lines}\n\nUse these real results to answer the client. Be specific about price and availability.`;
            } else {
              content = `Availability check timed out or no results. Tell the client: "Let me confirm availability and get back to you today."`;
            }

            toolResults.push({ type: "tool_result", tool_use_id: toolCall.id, content });

          } catch (err) {
            toolResults.push({ type: "tool_result", tool_use_id: toolCall.id,
              content: `Availability check error: ${err.message}. Tell the client you'll confirm today.` });
          }

        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: "Tool not available.",
          });
        }
      }

      // Append assistant turn + tool results and loop
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: data.content },
        { role: "user",      content: toolResults },
      ];
    }

    // Fallback if loop exhausted
    return res.status(200).json({
      text: "Lo siento, tuve un problema procesando tu solicitud. Por favor escríbeme de nuevo.",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
