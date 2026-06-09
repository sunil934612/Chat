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

/* ---------- CORS ---------- */
app.use(cors());

/* ---------- UPLOAD FOLDER ---------- */
const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ---------- MULTER ---------- */
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

/* ---------- GROQ ---------- */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* ---------- HOME ---------- */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend running 🚀"
  });
});

/* ---------- ANALYZE ---------- */
app.post(
  "/api/analyze",
  upload.single("resume"),
  async (req, res) => {

    let filePath;

    try {

      /* ---------- FILE CHECK ---------- */
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No PDF uploaded"
        });
      }

      filePath = path.resolve(req.file.path);

      /* ---------- READ PDF ---------- */
      const buffer = fs.readFileSync(filePath);

      let pdfData;

      try {

        pdfData = await pdfParse(buffer);

      } catch {

        return res.status(400).json({
          success: false,
          error: "Cannot read PDF"
        });
      }

      const resumeText =
        pdfData.text.replace(/\s+/g, " ").trim();

      if (!resumeText || resumeText.length < 20) {
        return res.status(400).json({
          success: false,
          error: "No readable text found"
        });
      }

      /* ---------- AI RESPONSE ---------- */
      const aiResponse =
        await groq.chat.completions.create({

          model: "llama-3.3-70b-versatile",

          messages: [
            {
              role: "system",
              content: `
You are an advanced ATS Resume Analyzer.

Analyze the resume carefully and return ONLY valid JSON.

Generate REALISTIC scores based on the resume content.

Format:

{
  "score": 85,

  "scoreBreakdown": {
    "formatting": 90,
    "content": 85,
    "skills": 80,
    "experience": 88,
    "achievements": 75
  },

  "strengths": [
    "Strong frontend projects",
    "Good technical skills"
  ],

  "improvements": [
    "Add more quantified achievements",
    "Improve resume summary"
  ],

  "skills": [
    "React.js",
    "Node.js",
    "MongoDB"
  ],

  "missingSkills": [
    "Docker",
    "AWS"
  ],

  "aiSuggestion":
    "Add measurable achievements and ATS keywords.",

  "summary":
    "Well-structured resume with strong technical skills."
}

Rules:
- Return ONLY valid JSON
- No markdown
- No explanation
- No extra text
- All scores must be generated dynamically from resume quality
`
            },
            {
              role: "user",
              content: resumeText
            }
          ]
        });

      /* ---------- CLEAN AI RESPONSE ---------- */
      let raw =
        aiResponse.choices[0].message.content;

      raw = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      /* ---------- PARSE JSON ---------- */
      let analysis;

      try {

        analysis = JSON.parse(raw);

      } catch {

        return res.status(500).json({
          success: false,
          error: "Invalid AI JSON response"
        });
      }

      /* ---------- DELETE FILE ---------- */
      fs.unlinkSync(filePath);

      /* ---------- SUCCESS ---------- */
      return res.json({
        success: true,
        analysis
      });

    } catch (error) {

      console.log(error);

      if (
        filePath &&
        fs.existsSync(filePath)
      ) {
        fs.unlinkSync(filePath);
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});