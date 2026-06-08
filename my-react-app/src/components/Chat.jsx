

import React, { useState } from "react";
import './Chat.css'

const ResumeAnalyzer = () => {

  const [file, setFile] = useState(null);

  const [analysis, setAnalysis] = useState("");

  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {

    if (!file) {
      alert("Please upload resume");
      return;
    }

    const formData = new FormData();

    formData.append("resume", file);

    setLoading(true);

    try {

      const response = await fetch(
        // "http://localhost:5000/api/analyze",

        "https://chat-1-ullv.onrender.com/api/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      setAnalysis(data.analysis);

    } catch (error) {

      console.log(error);

      setAnalysis("Error analyzing resume");
    }

    setLoading(false);
  };

  return (
    <div className="container py-5">

      <h1 className="mb-4 text-center">
        AI Resume Analyzer
      </h1>

      <div className="card p-4 shadow">

        <input
          type="file"
          className="form-control mb-3"
          accept=".pdf"
          onChange={(e) =>
            setFile(e.target.files[0])
          }
        />

        <button
          className="btn btn-primary"
          onClick={handleUpload}
        >
          Analyze Resume
        </button>

      </div>

      {loading && (
        <div className="mt-4">
          <h5>Analyzing Resume...</h5>
        </div>
      )}

      {analysis && (
        <div className="card p-4 shadow mt-4">

          <h3>Analysis Result</h3>

          <pre
            style={{
              whiteSpace: "pre-wrap",
            }}
          >
            {analysis}
          </pre>

        </div>
      )}

    </div>
  );
};

export default ResumeAnalyzer;