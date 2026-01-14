// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App.jsx"; // 👈 IMPORTA App, no TwoTravelCatalog

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />   {/* 👈 Usa App aquí */}
  </React.StrictMode>
);
