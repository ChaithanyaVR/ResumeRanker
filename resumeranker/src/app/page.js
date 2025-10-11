"use client";
import { useAuth } from "@/context/authContext";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createJobWithResumes,
  shortlistCandidates,
  fetchJobWithResumes,
  fetchGeminiResponses,
} from "utils/jobApi";
import GeminiResponses from "@/components/GeminiResponse/GeminiResponses";

const HomePage = () => {
  const { userLoggedIn, loading, currentUser } = useAuth();
  const router = useRouter();
  const cache = useRef({});

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [promptOption, setPromptOption] = useState("explanation");
  const [shortlistResults, setShortlistResults] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);

  const fileInputRef = useRef(null);
  const moreFilesRef = useRef(null);

  // Load saved job id on mount
  useEffect(() => {
    const saved = localStorage.getItem("currentJobId");
    if (saved) setCurrentJobId(saved);
  }, []);

  useEffect(() => {
    const savedJobId = localStorage.getItem("currentJobId");
    if (savedJobId) {
      setCurrentJobId(savedJobId);

      fetchJobWithResumes(savedJobId)
        .then((data) => {
          setJobTitle(data.job_title);
          setJobDescription(data.job_description);
          setFiles(
            data.resumes.map((r) => ({
              name: r.filename,
              path: r.file_path,
              resume_id: r.resume_id,
            }))
          );
        })
        .catch((err) => console.error("Failed to load saved job:", err));
    }
  }, []);

  // Reset everything
  const handleReset = (confirmFirst = true) => {
    if (confirmFirst) {
      const ok = window.confirm(
        "Start a new job? This will clear uploaded files and the saved job ID."
      );
      if (!ok) return;
    }

    localStorage.removeItem("currentJobId");
    setCurrentJobId(null);
    setJobTitle("");
    setJobDescription("");
    setFiles([]);
    setShortlistResults([]);
    setPromptOption("explanation");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (moreFilesRef.current) moreFilesRef.current.value = "";
  };

  // Redirect to login if needed
  const handleProtectedInteraction = () => {
    if (!loading && !userLoggedIn) {
      router.push("/login");
    }
  };

  // Create job only once
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser?.uid) {
      alert("You must be logged in to submit.");
      return;
    }

    if (!jobTitle || !jobDescription || files.length === 0) {
      alert("Please fill all fields and upload resumes.");
      return;
    }

    try {
      let jobId = currentJobId;

      // ✅ Only create a new job if one doesn’t exist
      if (!jobId) {
        const jobData = await createJobWithResumes({
          user_id: currentUser.uid,
          job_title: jobTitle,
          job_description: jobDescription,
          files,
        });
        jobId = jobData.job_id;
        setCurrentJobId(jobId);
        localStorage.setItem("currentJobId", jobId);
      } else {
       
        const cacheKey = `${jobId}_${promptOption}`;
        if (cache.current[cacheKey]) {
         
          setShortlistResults(cache.current[cacheKey]);
        } else {
          const cached = await fetchGeminiResponses(jobId, promptOption);
          if (cached.length > 0) {
           
            cache.current[cacheKey] = cached; // store in memory cache
            setShortlistResults(cached);
          } else {
           
            const results = await shortlistCandidates({
              job_id: jobId,
              topK: 5,
              rerank: true,
              promptType: promptOption,
            });
            cache.current[cacheKey] = results; // store AI results in memory cache
            setShortlistResults(results);
          }
        }
      }

      await fetchResults(jobId, promptOption);
    } catch (err) {
      console.error("❌ Error:", err);
      alert(err.message || "Something went wrong.");
    }
  };

  // Fetch results for a given prompt type
  const fetchResults = async (jobId, promptType) => {
    try {
      const results = await shortlistCandidates({
        job_id: jobId,
        topK: 5,
        rerank: true,
        promptType,
      });
      setShortlistResults(results);
     
    } catch (err) {
      if (err.message.includes("AI model overloaded")) {
        alert("⚠️ AI model is overloaded. Results will be generated later.");
      } else {
        console.error("❌ Error:", err);
        alert("Error fetching results.");
      }
    }
  };

 
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
        {/* Left Panel: Form Section */}
        <div className="flex-1 bg-[#1e293b] p-8 rounded-2xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Job Title
              </label>
              <input
                onFocus={handleProtectedInteraction}
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Enter job title"
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Job Description
              </label>
              <textarea
                onFocus={handleProtectedInteraction}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Enter job description..."
                className="w-full h-40 resize-none overflow-auto px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              {" "}
              <label className="block text-sm font-semibold mb-1">
                {" "}
                Choose Prompt{" "}
              </label>{" "}
              <select
                onFocus={handleProtectedInteraction}
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                onChange={(e) => setPromptOption(e.target.value)}
              >
                {" "}
                <option value="explanation">Explanation</option>{" "}
                <option value="extraction">Extraction</option>{" "}
                <option value="scoring">Scoring</option>{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-semibold mb-1">
                {" "}
                Upload Resumes{" "}
              </label>{" "}
              <div className="flex items-center justify-between gap-3">
                {" "}
                <input
                  ref={fileInputRef}
                  disabled={!currentUser?.uid}
                  type="file"
                  multiple
                  onChange={(e) =>
                    setFiles((prev) => [...prev, ...Array.from(e.target.files)])
                  }
                  className="block text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-yellow-600 file:text-white hover:file:bg-yellow-500"
                  accept=".pdf,.doc,.docx"
                />{" "}
                <button
                  type="button"
                  onClick={() =>
                    moreFilesRef.current && moreFilesRef.current.click()
                  }
                  className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-md flex flex-nowrap"
                >
                  {" "}
                  ➕ Add More{" "}
                </button>{" "}
                <input
                  ref={moreFilesRef}
                  id="more-files"
                  type="file"
                  multiple
                  hidden
                  onChange={(e) =>
                    setFiles((prev) => [...prev, ...Array.from(e.target.files)])
                  }
                  accept=".pdf,.doc,.docx"
                />{" "}
              </div>{" "}
            </div>
            {files.length > 0 && (
              <div>
                <div className="text-sm text-gray-300 mb-1 flex justify-between items-center">
                  <span>
                    {files.length} resume{files.length > 1 ? "s" : ""} selected
                  </span>
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="text-yellow-400 hover:underline text-xs"
                  >
                    {showAll ? "Hide Resumes" : "Show All Resumes"}
                  </button>
                </div>
                <div
                  className={`${
                    showAll ? "max-h-64" : "max-h-28"
                  } overflow-y-auto border border-gray-600 rounded-md p-2 bg-gray-800 text-xs`}
                >
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {files.map((file, idx) => (
                      <li key={idx}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-between items-center">
              <button
                onClick={() => handleReset(true)}
                type="button"
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-md mr-4"
              >
                Clear All
              </button>
              <button
                disabled={!currentUser?.uid}
                type="submit"
                className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md transition duration-300"
              >
                Submit
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: Instructions */}
        <div className="md:w-1/3 bg-[#1e293b] p-6 rounded-2xl shadow-lg space-y-4 h-fit">
          <h2 className="text-xl font-bold text-yellow-400">
            How does it work?
          </h2>
          <ul className="list-disc list-inside text-sm space-y-2">
            <li>Enter the job title and detailed description.</li>
            <li>Upload resumes.</li>
            <li>Create the job once, then switch prompts freely.</li>
            <li>AI updates results instantly when prompt changes.</li>
          </ul>
        </div>
      </div>

      <GeminiResponses jobId={currentJobId} promptType={promptOption} />
    </div>
  );
};

export default HomePage;
