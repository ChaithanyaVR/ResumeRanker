from typing import List, Dict, Any
from db import get_db, put_db
from pinecone_client import get_index
from gemini_client import embed_texts, generate_text
import time
import random
import json
from google.api_core.exceptions import ResourceExhausted
import psycopg2
from psycopg2 import extras

# ---- PROMPTS ----
SCORING_SYSTEM = """You are an ATS assistant. Score the candidate resume STRICTLY against the job description. 
Return a single JSON object with fields: score (0-100), strengths (array), gaps (array), summary (string)."""

SCORING_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Return only JSON with keys: score, strengths, gaps, summary.
"""

EXPLANATION_SYSTEM = """You are a career assistant. Explain in plain English how well the resume matches the job description."""
EXPLANATION_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Write a clear explanation of fit. Do not output JSON.
"""

EXTRACTION_SYSTEM = """You are an information extractor. Extract structured fields from the resume relevant to the job description."""
EXTRACTION_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Return JSON with keys: skills (array), experience_years (int), education (string), relevant_projects (array).
"""



# ---- MAIN FUNCTION ----
def shortlist(job_id: int, job_description_text: str, top_k: int = 10, rerank: bool = True, prompt_type: str = "scoring") -> List[Dict[str, Any]]:
    # 1) Embed JD and query Pinecone
    query_vec = embed_texts([job_description_text])[0]
    index = get_index()
    results = index.query(
    vector=query_vec,
    top_k=top_k,
    include_metadata=True,
    filter={"job_id": int(job_id)}
)



    # 2) Aggregate hits per resume
    scores_by_resume = {}
    for m in results.matches:
        rid = m.metadata.get("resume_id")
        scores_by_resume.setdefault(rid, {"score": 0.0, "hits": 0, "chunks": []})
        scores_by_resume[rid]["score"] += m.score or 0.0
        scores_by_resume[rid]["hits"] += 1
        scores_by_resume[rid]["chunks"].append(m)

    # 3) Top resumes
    ranked = sorted(scores_by_resume.items(), key=lambda kv: kv[1]["score"], reverse=True)[:top_k]
    resume_ids = [rid for rid, _ in ranked]

    if not rerank:
        return [{"resume_id": rid, "semantic_score": meta["score"]} for rid, meta in ranked]

    # 4) Choose prompt templates
    if prompt_type == "explanation":
        system_prompt = EXPLANATION_SYSTEM
        user_tmpl = EXPLANATION_USER_TMPL
    elif prompt_type == "extraction":
        system_prompt = EXTRACTION_SYSTEM
        user_tmpl = EXTRACTION_USER_TMPL
    else:  # default = scoring
        system_prompt = SCORING_SYSTEM
        user_tmpl = SCORING_USER_TMPL

    # 5) Re-rank & generate LLM output
    
    conn = get_db()
    out = []
    temp_results = []
    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                temp_results = []
                for rid in resume_ids:
                    rid = int(rid)
                    prompt_type = prompt_type.lower()
                    cur.execute("""
                    SELECT content 
                    FROM gemini_responses
                    WHERE resume_id = %s 
                    AND response_type = %s::gemini_response_type 
                    AND status = 'success'::response_status
                    """, (rid, prompt_type))

                    existing = cur.fetchone()
                    
                    if existing:
                        print(f"✅ Using cached result for resume {rid}, prompt {prompt_type}")
                        content_data = existing["content"]
                        if isinstance(content_data, str):
                            content_data = json.loads(content_data)
                            out.append({
                            "resume_id": rid,
                            "prompt_type": prompt_type,
                            "result": content_data,
                            "status": "success"
                             })
                        continue
                     # --- Insert pending row before Gemini call ---
                    cur.execute("""
                    INSERT INTO gemini_responses (resume_id, response_type, content, status)
                    VALUES (%s, %s::gemini_response_type, %s, 'pending'::response_status)
                    ON CONFLICT (resume_id, response_type)
                    DO UPDATE SET
                    status = 'pending'::response_status,
                    created_at = NOW(),
                    content = '{}'::jsonb
                    """, (rid, prompt_type, json.dumps({})))
 

                    # fetch resume text first
                    cur.execute("SELECT text_content FROM resumes WHERE id = %s", (rid,))
                    row = cur.fetchone()
                    resume_text = row["text_content"] if row and "text_content" in row else ""

                   
                    user_prompt = user_tmpl.format(jd=job_description_text, resume=resume_text[:20000])
                    try:
                        explanation_text = generate_text(system_prompt, user_prompt)
                        status = "success"
                        content_obj = {"text": explanation_text}
                    except ResourceExhausted as e:
                        print(f"⚠ Gemini overloaded for resume {rid}: {e}")
                        status = "failed"  # Mark as failed instead of pending
                        content_obj = {"error": "Resource exhausted — please retry later."}

                    except Exception as e:
                        print(f"❌ Gemini processing failed for resume {rid}: {e}")
                        status = "failed"
                        content_obj = {"error": str(e)}

                    temp_results.append((rid, prompt_type, content_obj, status))

                            # mark the row as failed
                    for rid, ptype, content_obj, status in temp_results:
                        cur.execute("""
                        INSERT INTO gemini_responses (resume_id, response_type, content, status)
                        VALUES (%s, %s::gemini_response_type, %s::jsonb, %s::response_status)
                        ON CONFLICT (resume_id, response_type)
                        DO UPDATE SET
                            content = EXCLUDED.content,
                            status = EXCLUDED.status,
                            created_at = NOW()
                    """, (rid, ptype, json.dumps(content_obj), status))

                    out.append({
                        "resume_id": rid,
                        "prompt_type": ptype,
                        "result": content_obj,
                        "status": status
                    })

    except Exception as e:
        conn.rollback()
        print("❌ shortlist() error:", e)
        raise
    finally:
        put_db(conn)

    return out