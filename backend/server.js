import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

/* ---------------- CORS (MOBILE SAFE) ---------------- */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://analyzer-steel.vercel.app",
      "https://your-vercel-domain.vercel.app"
    ],
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "20mb" }));

/* ---------------- HEALTH CHECK ---------------- */
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend running 🚀" });
});

/* ---------------- FILE UPLOAD ---------------- */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ---------------- GROQ AI ---------------- */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ---------------- API ---------------- */
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    filePath = req.file.path;

    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);

    const resumeText = pdfData.text
      .replace(/\s+/g, " ")
      .slice(0, 6000);

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        error: "Empty resume text",
      });
    }

    /* ---------------- AI CALL ---------------- */
    const aiResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
Return ONLY JSON:
{
  "score": 0,
  "scoreBreakdown": {
    "formatting": 0,
    "content": 0,
    "skills": 0,
    "experience": 0,
    "achievements": 0
  },
  "strengths": [],
  "improvements": [],
  "skills": [],
  "missingSkills": [],
  "aiSuggestion": "",
  "summary": ""
}
`,
        },
        {
          role: "user",
          content: resumeText,
        },
      ],
    });

    let raw = aiResponse.choices[0].message.content;
    raw = raw.replace(/```json|```/g, "").trim();

    let analysis = JSON.parse(raw);

    fs.unlinkSync(filePath);

    return res.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.log("ERROR:", error.message);

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

/* ---------------- START ---------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});