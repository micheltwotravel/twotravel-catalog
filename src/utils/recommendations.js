const norm = (v) => String(v ?? "").trim().toLowerCase();

const priceBand = (price_cop) => {
  const p = Number(price_cop || 0);
  if (!p) return "unknown";
  if (p < 200000) return "$";
  if (p < 420000) return "$$";
  return "$$$";
};

const budgetOk = (profileBudget, itemBand) => {
  if (profileBudget === "any") return true;
  if (itemBand === "unknown") return true;
  if (profileBudget === "$") return itemBand === "$";
  if (profileBudget === "$$") return itemBand === "$" || itemBand === "$$";
  return true;
};

export const INTEREST_TO_MATCH = {
  restaurants: { category: ["restaurants"] },
  rooftop: { subcategory: ["rooftop"] },
  bars: { category: ["bars", "nightlife"] },
  "beach-clubs": { category: ["beach-clubs"] },
  tours: { category: ["tours"] },
  wellness: { subcategory: ["wellness", "spa"] },
  adventure: { subcategory: ["adventure"] },
};

const matchInterest = (service, interestKey) => {
  const rule = INTEREST_TO_MATCH[interestKey];
  if (!rule) return false;
  const c = norm(service.category);
  const sc = norm(service.subcategory);
  if (rule.category && rule.category.includes(c)) return true;
  if (rule.subcategory && rule.subcategory.includes(sc)) return true;
  return false;
};

export function scoreService(service, profile) {
  let score = 0;

  for (const interest of profile.interests || []) {
    if (matchInterest(service, interest)) score += 30;
  }

  const sub = norm(service.subcategory);
  const desc = norm(service.description_es || service.description_en || "");

  if (profile.vibe === "party" && ["rooftop","club","latin","rum"].includes(sub)) score += 20;
  if (profile.vibe === "elegant" && ["fine-dining","contemporary"].includes(sub)) score += 20;
  if (profile.vibe === "relax" && desc.includes("relaj")) score += 15;
  if (profile.vibe === "cultural" && desc.includes("hist")) score += 15;

  if (profile.foodieLevel === "premium" && sub === "fine-dining") score += 20;

  const band = priceBand(service.price_cop);
  if (!budgetOk(profile.budget, band)) score -= 50;

  return score;
}

export function getRecommendations(services, profile, limit = 6) {
  return services
    .map(s => ({ ...s, _score: scoreService(s, profile) }))
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}
