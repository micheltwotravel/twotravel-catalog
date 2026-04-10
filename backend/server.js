import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "backend funcionando" });
});

async function appendToSheet(data) {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const values = [[
    data.submittedAt || new Date().toISOString(),
    data.kickoffId || "",
    data.guestName || "",
    data.tripName || "",
    data.language || "en",
    data.destination || "",
    data.concierge || "",
    data.occasion || "",
    data.overallExperience || "",
    data.overallReason || "",
    data.oneThing || "",
    data.organization || "",
    data.availability || "",
    data.preparedFactor || "",
    data.propertyRating || "",
    data.propertyNotes || "",
    data.speed || "",
    data.problemSolving || "",
    data.service || "",
    data.stayNotes || "",
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "feedback!A:T",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}


app.listen(3000, () => {
  console.log("Server running on port 3000");
});
app.get("/api/feedback/list", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || "")
          .replace(/^"|"$/g, "")
          .replace(/\\n/g, "\n")
          .trim(),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Feedback!A:T",
    });

    const rows = response.data.values || [];

    if (!rows.length) {
      return res.json([]);
    }

    const headers = rows[0].map((h) => String(h || "").trim());

    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? "";
      });
      return obj;
    });

    data.sort((a, b) => {
      const da = new Date(a.submittedAt || 0).getTime();
      const db = new Date(b.submittedAt || 0).getTime();
      return db - da;
    });

    res.json(data);
  } catch (error) {
    console.error("ERROR FEEDBACK LIST:", error);
    res.status(500).json({
      error: "No se pudo leer el feedback",
      details: error.message,
    });
  }
});