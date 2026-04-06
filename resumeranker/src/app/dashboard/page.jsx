"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { fetchJobsHistory, deleteJobHistory } from "@/utils/jobApi";

export default function page() {
  const router = useRouter();
  const { currentUser, userLoggedIn, loading } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1, limit: 10 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async (targetPage = 1) => {
    if (!currentUser?.uid) return;

    try {
      setLoadingHistory(true);
      setError("");
      const data = await fetchJobsHistory(currentUser.uid, targetPage, 10);
      setItems(data.items || []);
      setMeta({
        total: data.total || 0,
        total_pages: data.total_pages || 1,
        limit: data.limit || 10,
      });
      setPage(data.page || targetPage);
    } catch (err) {
      setError(err.message || "Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      router.replace("/login");
      return;
    }

    if (currentUser?.uid) {
      loadHistory(1);
    }
  }, [currentUser, loading, userLoggedIn]);

  const handleView = (jobId, prompt = "explanation") => {
    router.push(`/?jobId=${jobId}&prompt=${prompt}`);
  };

  const handleDelete = async (jobId) => {
    const ok = window.confirm("Delete this job history?");
    if (!ok) return;

    try {
      await deleteJobHistory(currentUser.uid, jobId);
      await loadHistory(page);
    } catch (err) {
      alert(err.message || "Failed to delete history");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 mt-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-[#1e293b] rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-yellow-400">Dashboard</h1>
          <p className="text-sm text-slate-300 mt-2">
            View, reopen, and delete previous resume ranking jobs.
          </p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-6 shadow-lg">
          {loadingHistory ? (
            <p className="text-slate-300">Loading history...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-slate-300">No history found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-yellow-400 border-b border-slate-700">
                      <th className="py-3 pr-4">Job Title</th>
                      <th className="py-3 pr-4">Resume Count</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Created</th>
                      <th className="py-3 pr-4">Updated</th>
                      <th className="py-3 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.job_id}
                        className="border-b border-slate-800 text-slate-200"
                      >
                        <td className="py-4 pr-4">
                          <div>
                            <p className="font-medium text-white">
                              {item.job_title}
                            </p>
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {item.job_description}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">{item.resume_count}</td>
                        <td className="py-4 pr-4">{item.status}</td>
                        <td className="py-4 pr-4">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 pr-4">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() =>
                                handleView(item.job_id, "explanation")
                              }
                              className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500"
                            >
                              Explanation
                            </button>
                            <button
                              onClick={() =>
                                handleView(item.job_id, "extraction")
                              }
                              className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500"
                            >
                              Extraction
                            </button>
                            <button
                              onClick={() => handleView(item.job_id, "scoring")}
                              className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500"
                            >
                              Scoring
                            </button>
                            <button
                              onClick={() =>
                                handleView(item.job_id, "suggestion")
                              }
                              className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-500"
                            >
                              Suggestion
                            </button>
                            <button
                              onClick={() => handleDelete(item.job_id)}
                              className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Page {page} of {meta.total_pages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => loadHistory(page - 1)}
                    className="px-4 py-2 rounded-md bg-slate-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= meta.total_pages}
                    onClick={() => loadHistory(page + 1)}
                    className="px-4 py-2 rounded-md bg-slate-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
