
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup (safe)
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (safe)
  },
});

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// -------------------------------
// SIMPLE PDF TEXT EXTRACT (SAFE)
// -------------------------------
import pdf from "pdf-parse/lib/pdf-parse.js";

// -------------------------------
// ROUTE
// -------------------------------
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  let filePath;

  try {
    // 1. Validate file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No resume file uploaded",
      });
    }

    filePath = path.resolve(req.file.path);

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: "Uploaded file not found on server",
      });
    }

    // 2. Read file safely
    const buffer = fs.readFileSync(filePath);

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Empty file uploaded",
      });
    }

    // 3. Extract PDF text (SAFE METHOD)
    const pdfData = await pdf(buffer);
    const resumeText = pdfData.text?.trim();

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        error: "Could not extract text from PDF",
      });
    }

    // 4. AI Analysis (Groq)
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
You are an ATS Resume Analyzer.

Return:
1. ATS Score (0-100)
2. Strengths
3. Weaknesses
4. Skills Found
5. Missing Skills
6. Suggestions
7. Short Summary

Be structured and clear.
          `,
        },
        {
          role: "user",
          content: resumeText,
        },
      ],
    });

    const analysis = response.choices?.[0]?.message?.content || "";

    // 5. Delete uploaded file (cleanup)
    fs.unlink(filePath, () => {});

    // 6. Response
    return res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Server Error:", error);

    // cleanup even if error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});