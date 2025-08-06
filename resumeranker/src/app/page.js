"use client";
import { useAuth } from "@/context/authContext";
import React, { useState } from "react";
import { useRouter } from "next/navigation";


const HomePage = () => {
  const { userLoggedIn, loading,  currentUser } = useAuth();
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [showAll, setShowAll] = useState(false);
  

  // This function handles redirection if the user is unauthenticated
  const handleProtectedInteraction = () => {
    if (!loading && !userLoggedIn) {
      router.push("/login");
    }
  };

  const handleSubmit = async () => {
    console.log('clicked..')
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
        {/* Left Panel: Form Section */}
        <div className="flex-1 bg-[#1e293b] p-8 rounded-2xl shadow-lg space-y-6">
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
            <label className="block text-sm font-semibold mb-1">
              Upload Resumes
            </label>
            <input
              disabled={!currentUser?.uid}
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-yellow-600 file:text-white hover:file:bg-yellow-500"
              accept=".pdf,.doc,.docx"
            />
          </div>

          {/* Resume File List */}
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

          {/* Submit Button */}
          <div className="pt-4 flex justify-end">
            <button
              disabled={!currentUser?.uid}
              onClick={handleSubmit}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 px-6 rounded-md transition duration-300"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Right Panel: Instructions */}
        <div className="md:w-1/3 bg-[#1e293b] p-6 rounded-2xl shadow-lg space-y-4 h-fit">
          <h2 className="text-xl font-bold text-yellow-400">
            How does it work?
          </h2>
          <ul className="list-disc list-inside text-sm space-y-2">
            <li>Enter the job title and detailed description.</li>
            <li>Upload one or more resumes (PDF or Word).</li>
            <li>Our AI analyzes compatibility in real time.</li>
            <li>Get instant feedback or next steps.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
