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

/* ---------------- CORS (FIXED FOR VERCEL + MOBILE) ---------------- */
const corsOptions = {
  origin: function (origin, callback) {
    // allow server-to-server / postman
    if (!origin) return callback(null, true);

    // allow localhost + all vercel apps
    if (
      origin.includes("localhost") ||
      origin.includes("vercel.app")
    ) {
      return callback(null, true);
    }

    return callback(null, true); // fallback allow (prevents network error)
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));



/* ---------------- BODY PARSER ---------------- */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* ---------------- UPLOAD DIR ---------------- */
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ---------------- MULTER ---------------- */
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/* ---------------- GROQ ---------------- */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ---------------- HEALTH CHECK ---------------- */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend running",
  });
});

/* ---------------- ANALYZE API ---------------- */
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No PDF uploaded",
      });
    }

    filePath = path.resolve(req.file.path);

    const buffer = fs.readFileSync(filePath);

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch {
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
        error: "No readable text found",
      });
    }

    /* ---------------- AI CALL ---------------- */
    const aiPromise = groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
Return ONLY JSON:
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
NO explanation, ONLY JSON.
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

    let raw = aiResponse.choices[0].message.content;
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let analysis;

    try {
      analysis = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        success: false,
        error: "Invalid AI response",
      });
    }

    /* ---------------- CLEAN FILE ---------------- */
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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