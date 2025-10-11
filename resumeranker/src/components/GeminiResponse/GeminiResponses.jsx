"use client";
import React, { useEffect, useState } from "react";
import { fetchGeminiResponses } from "@/utils/jobApi";

export default function GeminiResponses({ jobId, promptType }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    const loadGeminiResponses = async () => {
      try {
        const data = await fetchGeminiResponses(jobId, promptType);
        if (data.length > 0) {
          console.log(`🟢 Loaded Gemini results from DB for ${promptType}:`, data);
          setResults(data);
        } else {
          console.log(`⚪ No results found in DB for ${promptType}`);
          setResults([]);
        }
      } catch (err) {
        console.error("❌ Error fetching Gemini responses:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    loadGeminiResponses();
  }, [jobId, promptType]);

  if (!jobId) return null;

  if (loading)
    return <p className="text-gray-400 text-sm">Loading {promptType} results...</p>;

  if (results.length === 0)
    return (
      <p className="text-gray-400 text-sm italic">
        No {promptType} results available yet.
      </p>
    );

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold text-yellow-400 capitalize">
        {promptType} Results
      </h3>
      {results.map((res, i) => (
        <div key={i} className="p-4 border border-gray-700 rounded-md bg-gray-800">
          <p className="font-semibold text-white">{res.filename}</p>
          <p className="text-gray-400 text-xs">
            Created: {new Date(res.created_at).toLocaleString()}
          </p>
          <p className="text-gray-200 mt-2 whitespace-pre-line">
            {res.content?.text || "No content available."}
          </p>
        </div>
      ))}
    </div>
  );
}
