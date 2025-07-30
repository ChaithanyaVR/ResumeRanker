'use client';
import React, { useState } from 'react';

const HomePage = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [file, setFile] = useState(null);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
        {/* Left Panel: Form Section */}
        <div className="flex-1 bg-[#1e293b] p-8 rounded-2xl shadow-lg space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Enter job title"
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Enter job description..."
              className="w-full h-40 resize-none overflow-auto px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Upload Resumes</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-yellow-600 file:text-white hover:file:bg-yellow-500"
              accept=".pdf,.doc,.docx"
            />
          </div>
        </div>

        {/* Right Panel: Instructions */}
        <div className="md:w-1/3 bg-[#1e293b] p-6 rounded-2xl shadow-lg space-y-4 h-fit">
          <h2 className="text-xl font-bold text-yellow-400">How does it work?</h2>
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
