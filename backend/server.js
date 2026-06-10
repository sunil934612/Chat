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

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("Missing GROQ_API_KEY environment variable");
}

const groq = new Groq({ apiKey });

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes("localhost") || origin.includes("vercel.app")) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend running" });
});

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

    const resumeText = pdfData.text.replace(/\s+/g, " ").slice(0, 6000);

    if (!resumeText || resumeText.length < 20) {
      return res.status(400).json({
        success: false,
        error: "No readable text found",
      });
    }

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
          `.trim(),
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

    const raw =
      aiResponse?.choices?.[0]?.message?.content?.replace(/```json/g, "").replace(/```/g, "").trim() ||
      "";

    if (!raw) {
      return res.status(500).json({
        success: false,
        error: "Empty AI response",
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        success: false,
        error: "Invalid AI response",
      });
    }

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("ERROR:", error?.message || error);

    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.status(500).json({
      success: false,
      error: error?.message || "Server error",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});