import React, { useState } from "react";
import "./Chat.css";

const ResumeAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 LOCAL BACKEND URL
  const API_URL = "http://localhost:5000/api/analyze";

  const handleUpload = async () => {
    if (!file) {
      alert("Please upload a resume");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setLoading(true);
    setAnalysis("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      // ✅ SAFE RESPONSE HANDLING
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis(data.error || "Analysis failed");
      }

    } catch (error) {
      console.log(error);
      setAnalysis("Backend not running or network error");
    }

    setLoading(false);
  };

  return (
    <div className="container py-5">

      <h1 className="text-center mb-4">
        AI Resume Analyzer (Local)
      </h1>

      <div className="card p-4 shadow">

        <input
          type="file"
          className="form-control mb-3"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button
          className="btn btn-primary"
          onClick={handleUpload}
        >
          Analyze Resume
        </button>

      </div>

      {/* LOADING */}
      {loading && (
        <div className="mt-3 text-center">
          <h5>Analyzing Resume...</h5>
        </div>
      )}

      {/* RESULT */}
      {analysis && (
        <div className="card p-4 shadow mt-4">

          <h3>Analysis Result</h3>

          <pre style={{ whiteSpace: "pre-wrap" }}>
            {analysis}
          </pre>

        </div>
      )}

    </div>
  );
};

export default ResumeAnalyzer;