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


if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY");
}

/* ---------------- CORS (FIXED FOR MOBILE + VERCEL) ---------------- */

const allowedOrigins = [
  "http://localhost:5173",
  "https://analyzer-steel.vercel.app"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"]
}));

/* ---------------- BODY LIMIT (IMPORTANT FOR MOBILE FILES) ---------------- */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* ---------------- UPLOAD FOLDER ---------------- */
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ---------------- MULTER CONFIG ---------------- */
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB safe for resumes
  },
});

/* ---------------- GROQ INIT ---------------- */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ---------------- HEALTH CHECK ---------------- */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend running ",
  });
});

/* ---------------- ANALYZE API ---------------- */
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    /* ---------- FILE CHECK ---------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF uploaded",
      });
    }

    filePath = path.resolve(req.file.path);

    /* ---------- READ PDF ---------- */
    const buffer = fs.readFileSync(filePath);

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Cannot read PDF file",
      });
    }

    const resumeText = pdfData.text
          .replace(/\s+/g, " ")
          .slice(0, 6000);

    if (!resumeText || resumeText.length < 20) {
      return res.status(400).json({
        success: false,
        error: "No readable text found in resume",
      });
    }

    /* ---------------- GROQ TIMEOUT WRAPPER ---------------- */
    const aiPromise = groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
You are an ATS Resume Analyzer.

Return ONLY valid JSON:

{
  "score": 85,
  "scoreBreakdown": {
    "formatting": 90,
    "content": 85,
    "skills": 80,
    "experience": 88,
    "achievements": 75
  },
  "strengths": [],
  "improvements": [],
  "skills": [],
  "missingSkills": [],
  "aiSuggestion": "",
  "summary": ""
}

Rules:
- ONLY JSON
- NO markdown
- NO explanation
`,
        },
        {
          role: "user",
          content: resumeText,
        },
      ],
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout")), 90000)
    );

    const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

    /* ---------------- CLEAN RESPONSE ---------------- */
    let raw = aiResponse.choices[0].message.content;

    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Invalid AI JSON response",
      });
    }

    /* ---------------- DELETE FILE SAFELY ---------------- */
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    /* ---------------- SUCCESS ---------------- */
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
      error: error.message || "Server error",
    });
  }
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});