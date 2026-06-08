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

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* ---------------- UPLOAD FOLDER ---------------- */
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ---------------- MULTER ---------------- */
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single("resume");

/* ---------------- GROQ ---------------- */
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* ---------------- HEALTH CHECK ---------------- */
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend running" });
});

/* ---------------- RESUME ANALYZE API ---------------- */
app.post("/api/analyze", (req, res) => {
  upload(req, res, async (err) => {
    let filePath;

    try {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded"
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
          error: "Cannot read PDF (scanned or corrupted)"
        });
      }

      const resumeText = pdfData.text?.replace(/\s+/g, " ").trim();

      if (!resumeText || resumeText.length < 30) {
        return res.status(400).json({
          success: false,
          error: "No readable text in resume"
        });
      }

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `
You are an ATS Resume Analyzer.
Return:
- ATS Score (0-100)
- Strengths
- Weaknesses
- Skills Found
- Missing Skills
- Suggestions
- Short Summary
            `
          },
          {
            role: "user",
            content: resumeText
          }
        ]
      });

      const analysis =
        response?.choices?.[0]?.message?.content ||
        "No analysis generated";

      fs.unlink(filePath, () => {});

      return res.json({
        success: true,
        analysis
      });

    } catch (error) {
      console.error(error);

      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }

      return res.status(500).json({
        success: false,
        error: "Server error"
      });
    }
  });
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});