// src/App.jsx

import TwoTravelCatalog from "./TwoTravelCatalog";
import ConciergePanel from "./ConciergePanel"; // 👈 asegúrate que exista este archivo

export default function App() {
  console.log("LOCATION:", window.location.href); // debug
  const isInternal = window.location.search.includes("concierge=1");
  console.log("isInternal =", isInternal); // debug

  return isInternal ? <ConciergePanel /> : <TwoTravelCatalog />;
}
