//helper functions
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function createJobWithResumes({ user_id, job_title, job_description, files }) {
  const formData = new FormData();
  formData.append("user_id", user_id);
  formData.append("job_title", job_title);
  formData.append("job_description", job_description);

  files.forEach((file) => {
    formData.append("files", file);
  });

  const res = await fetch(`${API_BASE}/jobs-with-resumes`, {
    method: "POST",
    body: formData,
  });

  const data = await safeJson(res);
  if (!res.ok || !data.job_id) {
    throw new Error(data.error || "Failed to create job with resumes");
  }

  return data;
}

export async function fetchJobWithResumes(job_id) {
  if (!job_id) throw new Error("job_id is required");

  const res = await fetch(`${API_BASE}/job-details/${job_id}`, {
    method: "GET",
  });

  const data = await safeJson(res);
  if (!res.ok || !data.job_id) {
    throw new Error(data.error || "Failed to fetch job details");
  }

  return data; 
}


export async function fetchGeminiResponses(job_id, promptType = null) {
  if (!job_id) throw new Error("job_id is required");

  const url = new URL(`${API_BASE}/gemini-responses`);
  url.searchParams.append("job_id", job_id);
  if (promptType) url.searchParams.append("prompt_type", promptType);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await safeJson(res);

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch Gemini responses");
  }

  return data.results || [];
}



export async function waitForIndexSync(ms = 2000) {
  console.log(`⏳ Waiting ${ms / 1000}s for Pinecone index sync...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function shortlistCandidates({
  job_id,
  topK,
  rerank,
  promptType,
}) {
  const res = await fetch(`${API_BASE}/shortlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: job_id,
      top_k: topK,
      rerank,
      prompt_type: promptType,
    }),
  });

  const data = await safeJson(res);
  if (res.status === 503) {
    throw new Error("AI model overloaded. Please try again later.");
  }
  if (!res.ok || !data.results) {
    throw new Error(data.error || "Failed to shortlist candidates");
  }
  return data.results;
}
