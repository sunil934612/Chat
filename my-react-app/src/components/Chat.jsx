import React, { useState, useEffect } from "react";
import { FaChartBar, FaChartLine } from "react-icons/fa";
import { FaRobot, FaLightbulb } from "react-icons/fa";
import { FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { FaTools, FaEdit } from "react-icons/fa";
import "./Chat.css";

const ResumeAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ FIXED: use deployed backend (NOT localhost)
  const API_URL = "https://chat-3-5znd.onrender.com/api/analyze";

  useEffect(() => {
    const saved = sessionStorage.getItem("resumeData");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (parsed?.analysis) {
          setAnalysis(parsed.analysis);
          setFileName(parsed.fileName);
        }
      } catch (err) {
        console.log("Session parse error:", err);
        sessionStorage.removeItem("resumeData");
      }
    }
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      return;
    }

    setError("");
    setFile(selectedFile);
    setFileName(selectedFile.name);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please upload PDF file");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setLoading(true);
    setError("");

    // ✅ FIX: mobile-safe timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 90000); // 90 sec for AI + PDF

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // ✅ FIX: show real backend error
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const data = await response.json();
      console.log("API RESPONSE:", data);

      if (data.success) {
        setAnalysis(data.analysis);

        sessionStorage.setItem(
          "resumeData",
          JSON.stringify({
            analysis: data.analysis,
            fileName,
          })
        );
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (error) {
      console.log("FULL ERROR:", error);

      if (error.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError(error.message || "Something went wrong. Try again.");
      }
    }

    setLoading(false);
  };

  const handleClear = () => {
    sessionStorage.removeItem("resumeData");
    setAnalysis(null);
    setFile(null);
    setFileName("");
    setError("");
  };

  return (
    <div className="main-container">

      <div className="top-section">
        <div>
          <h1 className="main-heading">AI Resume Analyzer</h1>
          <p className="sub-heading">
            Upload resume and get AI-powered ATS insights
          </p>
        </div>
      </div>

      <div className="upload-card">
        <input
          type="file"
          accept=".pdf"
          className="file-input"
          onChange={handleFileChange}
        />

        {fileName && (
          <p className="file-name">{fileName}</p>
        )}

        <div className="btn-group">
          <button className="analyze-btn" onClick={handleUpload}>
            Analyze Resume
          </button>

          <button className="clear-btn" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "red", marginBottom: "10px", textAlign: "center" }}>
          {error}
        </p>
      )}

      {loading && (
        <div className="loading-card">
          <h3>Analyzing Resume...</h3>
        </div>
      )}

      {!analysis && (
        <div className="features-section">

          <div className="feature-card">
            <div className="feature-icon">
              <FaChartBar style={{ color: "#3b82f6", fontSize: "22px" }} />
            </div>
            <h3>ATS Score Analysis</h3>
            <p>Get detailed ATS compatibility score and improve resume ranking.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaRobot style={{ color: "#10b981", fontSize: "22px" }} />
            </div>
            <h3>AI Suggestions</h3>
            <p>Receive smart AI recommendations to improve your resume instantly.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaExclamationTriangle style={{ color: "#ef4444", fontSize: "22px" }} />
            </div>
            <h3>Missing Skills</h3>
            <p>Detect important missing technologies and keywords from your resume.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaTools style={{ color: "#f59e0b", fontSize: "22px" }} />
            </div>
            <h3>Resume Improvements</h3>
            <p>Improve formatting, readability, and overall resume quality.</p>
          </div>

        </div>
      )}

      {analysis && (

        <div className="result-grid">

          <div>

            <div className="card-box file-card">
              <div>
                <h3>{fileName}</h3>
                <p className="light-text">Resume analyzed successfully</p>
              </div>
              <span className="success-badge">Analyzed</span>
            </div>

            <div className="card-box score-card">
              <div className="score-circle">
                <h1>{analysis.score}</h1>
                <span>/100</span>
              </div>
              <div>
                <h2 className="excellent-text">Overall Score</h2>
                <p className="result-text">{analysis.summary}</p>
              </div>
            </div>

            <div className="card-box">
              <h3 className="card-title">Strengths</h3>
              <ul>
                {analysis.strengths?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card-box">
              <h3 className="card-title">Areas to Improve</h3>
              <ul>
                {analysis.improvements?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

          </div>

          <div>

            <div className="card-box">
              <h3 className="card-title">Score Breakdown</h3>

              {Object.entries(analysis.scoreBreakdown || {}).map(([key, value]) => (
                <div key={key} className="progress-wrapper">
                  <div className="progress-header">
                    <span className="capitalize">{key}</span>
                    <span>{value}/100</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${value}%` }}></div>
                  </div>
                </div>
              ))}

            </div>

            <div className="card-box">
              <h3 className="card-title">Top Skills Found</h3>
              <div className="skills-container">
                {analysis.skills?.map((skill, index) => (
                  <span key={index} className="skill-badge">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="card-box">
              <h3 className="card-title">Missing Skills</h3>
              <div className="skills-container">
                {analysis.missingSkills?.map((skill, index) => (
                  <span key={index} className="missing-badge">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="suggestion-box">
              <h3 className="suggestion-title">AI Suggestion</h3>
              <p className="suggestion-text">
                {analysis.aiSuggestion}
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default ResumeAnalyzer;