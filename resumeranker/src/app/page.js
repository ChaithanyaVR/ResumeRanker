"use client";
import { useAuth } from "@/context/authContext";
import React, { useEffect, useRef, useState } from "react";
import { useRouter ,useSearchParams} from "next/navigation";
import {
  createJobWithResumes,
  shortlistCandidates,
  fetchJobWithResumes,
  fetchGeminiResponses,
  fetchRepositoryResumes,
} from "utils/jobApi";
import GeminiResponses from "@/components/GeminiResponse/GeminiResponses";

const HomePage = () => {
  const { userLoggedIn, loading, currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [promptOption, setPromptOption] = useState("explanation");
  const [shortlistResults, setShortlistResults] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [showRepositoryBox, setShowRepositoryBox] = useState(false);
  const [repositoryResumes, setRepositoryResumes] = useState([]);
  const [selectedRepoResumes, setSelectedRepoResumes] = useState([]);
  const [repositorySearch, setRepositorySearch] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [repositoryError, setRepositoryError] = useState("");
  const resultsSectionRef = useRef(null);

  const fileInputRef = useRef(null);
  const moreFilesRef = useRef(null);



  // Load saved job id on mount
  useEffect(() => {
    const saved = localStorage.getItem("currentJobId");
    if (saved) setCurrentJobId(saved);
  }, []);




useEffect(() => {
  const queryJobId = searchParams.get("jobId");
  const queryPrompt = searchParams.get("prompt");
  const savedJobId = queryJobId || localStorage.getItem("currentJobId");

  if (queryPrompt) {
    setPromptOption(queryPrompt);
  }

  if (!savedJobId) return;

  setCurrentJobId(savedJobId);
  localStorage.setItem("currentJobId", savedJobId);

  fetchJobWithResumes(savedJobId)
    .then((data) => {
      setJobTitle(data.job_title);
      setJobDescription(data.job_description);
      setFiles(
        data.resumes.map((r) => ({
          name: r.filename,
          path: r.file_path,
          resume_id: r.resume_id,
        })),
      );
    })
    .catch((err) => console.error("Failed to load saved job:", err));
}, [searchParams]);


  const scrollToResults = () => {
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  };

  // Reset everything
  const handleReset = (confirmFirst = true) => {
    if (confirmFirst) {
      const ok = window.confirm(
        "Start a new job? This will clear uploaded files and the saved job ID.",
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
    setSelectedRepoResumes([]);
    setActiveFilters([]);
    setRepositorySearch("");
    setShowRepositoryBox(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (moreFilesRef.current) moreFilesRef.current.value = "";
  };

  const loadRepositoryResumes = async () => {
    if (!currentUser?.uid) return;

    try {
      setRepositoryLoading(true);
      setRepositoryError("");
      const resumes = await fetchRepositoryResumes(currentUser.uid);
      setRepositoryResumes(resumes);
    } catch (err) {
      setRepositoryError(err.message || "Failed to load repository resumes");
    } finally {
      setRepositoryLoading(false);
    }
  };

  const handleRepositoryToggle = async () => {
    handleProtectedInteraction();
    if (!currentUser?.uid) return;

    const nextValue = !showRepositoryBox;
    setShowRepositoryBox(nextValue);

    if (nextValue && repositoryResumes.length === 0) {
      await loadRepositoryResumes();
    }
  };

  const addFilterChip = () => {
    const value = repositorySearch.trim();
    if (!value) return;

    const alreadyExists = activeFilters.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    );

    if (!alreadyExists) {
      setActiveFilters((prev) => [...prev, value]);
    }

    setRepositorySearch("");
  };

  const removeFilterChip = (chip) => {
    setActiveFilters((prev) => prev.filter((item) => item !== chip));
  };

  const toggleRepositoryResume = (resume) => {
    setSelectedRepoResumes((prev) => {
      const exists = prev.some((item) => item.id === resume.id);
      if (exists) {
        return prev.filter((item) => item.id !== resume.id);
      }
      return [...prev, resume];
    });
  };

  const filteredRepositoryResumes = repositoryResumes.filter((resume) => {
    if (activeFilters.length === 0) return true;

    const searchableText = (
      resume.searchable_text ||
      [resume.title || resume.filename || "", ...(resume.keywords || [])].join(
        " ",
      )
    ).toLowerCase();

    return activeFilters.every((filter) =>
      searchableText.includes(filter.toLowerCase()),
    );
  });

  const effectiveRepoResumes =
    selectedRepoResumes.length > 0
      ? selectedRepoResumes
      : showRepositoryBox
        ? filteredRepositoryResumes
        : [];

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

    if (!jobTitle || !jobDescription) {
      alert("Please fill all fields.");
      return;
    }

    if (files.length === 0 && effectiveRepoResumes.length === 0) {
      alert("Please upload resumes or choose resumes from repository.");
      return;
    }

    try {
      let jobId = currentJobId;

      if (!jobId) {
        const jobData = await createJobWithResumes({
          user_id: currentUser.uid,
          job_title: jobTitle,
          job_description: jobDescription,
          files,
          repositoryResumeIds: effectiveRepoResumes.map((item) => item.id),
        });

        jobId = jobData.job_id;
        setCurrentJobId(jobId);
        localStorage.setItem("currentJobId", jobId);
      }

      await fetchResults(jobId, promptOption);
    } catch (err) {
      console.error("Error:", err);
      alert(err.message || "Something went wrong.");
    }
  };

  // Fetch results for a given prompt type
 useEffect(() => {
    if (!currentJobId || !promptOption) return;

    const loadResults = async () => {
      try {
        const results = await shortlistCandidates({
          job_id: currentJobId,
          topK: 5,
          rerank: true,
          promptType: promptOption,
        });

        console.log("shortlisted results...", results);
        setShortlistResults(results);
        scrollToResults();
      } catch (err) {
        if (err.message?.includes("AI model overloaded")) {
          alert("AI model is overloaded. Results will be generated later.");
        } else {
          console.error("Error fetching results:", err);
        }
      }
    };

    loadResults();
  }, [currentJobId, promptOption]);


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
                value={promptOption}
                onFocus={handleProtectedInteraction}
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                onChange={(e) => setPromptOption(e.target.value)}
              >
                {" "}
                <option value="explanation">Explanation</option>{" "}
                <option value="extraction">Extraction</option>{" "}
                <option value="scoring">Scoring</option>{" "}
                <option value="suggestion">Suggestion</option>{" "}
              </select>{" "}
            </div>{" "}
            <button
              type="button"
              onClick={handleRepositoryToggle}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md"
            >
              Add From Repository
            </button>
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
            {showRepositoryBox && (
              <div className="border border-gray-600 rounded-xl p-4 bg-gray-900 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    value={repositorySearch}
                    onChange={(e) => setRepositorySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFilterChip();
                      }
                    }}
                    placeholder="Search by title or keyword"
                    className="flex-1 px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    type="button"
                    onClick={addFilterChip}
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-md"
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => loadRepositoryResumes()}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-md"
                  >
                    Refresh
                  </button>
                </div>

                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => removeFilterChip(chip)}
                        className="px-3 py-1 rounded-full bg-yellow-700 text-white text-sm"
                      >
                        {chip} ×
                      </button>
                    ))}
                  </div>
                )}
                {selectedRepoResumes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRepoResumes.map((resume) => (
                      <button
                        key={resume.id}
                        type="button"
                        onClick={() => toggleRepositoryResume(resume)}
                        className="px-3 py-1 rounded-full bg-green-700 text-white text-sm"
                      >
                        {resume.title} ×
                      </button>
                    ))}
                  </div>
                )}

                {repositoryLoading && (
                  <p className="text-sm text-gray-300">
                    Loading repository resumes...
                  </p>
                )}

                {repositoryError && (
                  <p className="text-sm text-red-400">{repositoryError}</p>
                )}

                {!repositoryLoading && !repositoryError && (
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {filteredRepositoryResumes.length === 0 ? (
                      <p className="text-sm text-gray-400">No resumes found.</p>
                    ) : (
                      filteredRepositoryResumes.map((resume) => {
                        const checked = selectedRepoResumes.some(
                          (item) => item.id === resume.id,
                        );

                        return (
                          <label
                            key={resume.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRepositoryResume(resume)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-white">
                                {resume.title}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(resume.keywords || [])
                                  .slice(0, 8)
                                  .map((keyword) => (
                                    <span
                                      key={`${resume.id}-${keyword}`}
                                      className="px-2 py-1 rounded-full bg-slate-700 text-xs text-gray-200"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
            {(files.length > 0 || selectedRepoResumes.length > 0) && (
              <div>
                <div className="text-sm text-gray-300 mb-1 flex justify-between items-center">
                  <span>
                    {files.length} uploaded, {effectiveRepoResumes.length} from
                    repository
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="text-yellow-400 hover:underline text-xs"
                  >
                    {showAll ? "Hide Resumes" : "Show All Resumes"}
                  </button>
                </div>

                <div
                  className={`${showAll ? "max-h-64" : "max-h-28"} overflow-y-auto border border-gray-600 rounded-md p-2 bg-gray-800 text-xs`}
                >
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {files.map((file, idx) => (
                      <li key={`file-${idx}`}>{file.name}</li>
                    ))}
                    {effectiveRepoResumes.map((resume) => (
                      <li key={`repo-${resume.id}`}>{resume.title}</li>
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

      <div ref={resultsSectionRef} className="scroll-mt-24">
  <GeminiResponses results={shortlistResults} promptType={promptOption} />
</div>

    </div>
  );
};

export default HomePage;
