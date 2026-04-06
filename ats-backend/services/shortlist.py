# # from typing import List, Dict, Any
# # from db import get_db, put_db
# # from pinecone_client import get_index
# # from ollama_client import embed_texts, generate_text
# # import time
# # import random
# # import json
# # import psycopg2
# # from psycopg2 import extras

# # # ---- PROMPTS ----
# # SCORING_SYSTEM = """You are an ATS assistant. Score the candidate resume STRICTLY against the job description. 
# # Return a single JSON object with fields: score (0-100), strengths (array), gaps (array), summary (string)."""

# # SCORING_USER_TMPL = """Job Description:
# # {jd}

# # Candidate Resume:
# # {resume}

# # Return only JSON with keys: score, strengths, gaps, summary.
# # """

# # EXPLANATION_SYSTEM = """You are a career assistant. Explain in plain English how well the resume matches the job description."""
# # EXPLANATION_USER_TMPL = """Job Description:
# # {jd}

# # Candidate Resume:
# # {resume}

# # Write a clear explanation of fit. Do not output JSON.
# # """

# # EXTRACTION_SYSTEM = """You are an information extractor. Extract structured fields from the resume relevant to the job description."""
# # EXTRACTION_USER_TMPL = """Job Description:
# # {jd}

# # Candidate Resume:
# # {resume}

# # Return JSON with keys: skills (array), experience_years (int), education (string), relevant_projects (array).
# # """

# # SUGGESTION_SYSTEM = """You are a career assistant and ATS optimization expert.
# # Analyze the resume against the job description and provide clear, actionable suggestions
# # to improve the candidate’s fit for the role."""

# # SUGGESTION_USER_TMPL = """Job Description:
# # {jd}

# # Candidate Resume:
# # {resume}

# # Based on the job description, suggest improvements for the resume.

# # Return a single JSON object with the following keys only:
# # - missing_skills (array of strings)
# # - resume_improvements (array of strings)
# # - project_suggestions (array of strings)
# # - learning_recommendations (array of strings)
# # - overall_advice (string)
# # """



# # # ---- MAIN FUNCTION ----
# # def shortlist(job_id: int, job_description_text: str, top_k: int = 10, rerank: bool = True, prompt_type: str = "scoring") -> List[Dict[str, Any]]:
# #     # 1) Embed JD and query Pinecone
# #     query_vec = embed_texts([job_description_text])[0]
# #     index = get_index()
# #     results = index.query(
# #     vector=query_vec,
# #     top_k=top_k,
# #     include_metadata=True,
# #     filter={"job_id": int(job_id)}
# # )



# #     # 2) Aggregate hits per resume
# #     scores_by_resume = {}
# #     for m in results.matches:
# #         rid = m.metadata.get("resume_id")
# #         scores_by_resume.setdefault(rid, {"score": 0.0, "hits": 0, "chunks": []})
# #         scores_by_resume[rid]["score"] += m.score or 0.0
# #         scores_by_resume[rid]["hits"] += 1
# #         scores_by_resume[rid]["chunks"].append(m)

# #     # 3) Top resumes
# #     ranked = sorted(scores_by_resume.items(), key=lambda kv: kv[1]["score"], reverse=True)[:top_k]
# #     resume_ids = [rid for rid, _ in ranked]


# #     if not rerank:
# #         return [{"resume_id": rid, "semantic_score": meta["score"]} for rid, meta in ranked]

# #     # 4) Choose prompt templates
# #     if prompt_type == "explanation":
# #         system_prompt = EXPLANATION_SYSTEM
# #         user_tmpl = EXPLANATION_USER_TMPL
# #     elif prompt_type == "extraction":
# #         system_prompt = EXTRACTION_SYSTEM
# #         user_tmpl = EXTRACTION_USER_TMPL
# #     elif prompt_type == "scoring":
# #         system_prompt = SCORING_SYSTEM
# #         user_tmpl = SCORING_USER_TMPL
# #     else:
# #         system_prompt = SUGGESTION_SYSTEM
# #         user_tmpl = SUGGESTION_USER_TMPL
        
# #     # 5) Re-rank & generate LLM output
    
# #     conn = get_db()
# #     out = []
# #     temp_results = []
# #     try:
# #         with conn:
# #             with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
# #                 temp_results = []
# #                 cur.execute(
# #                 "SELECT id FROM resumes WHERE id = ANY(%s)",
# #                 (resume_ids,)
# #                 )
# #                 valid_ids = {row["id"] for row in cur.fetchall()}
# #                 resume_ids = [rid for rid in resume_ids if rid in valid_ids]
# #                 for rid in resume_ids:
# #                     rid = int(rid)
# #                     prompt_type = prompt_type.lower()
# #                     cur.execute("""
# #                     SELECT content 
# #                     FROM gemini_responses
# #                     WHERE resume_id = %s 
# #                     AND response_type = %s::gemini_response_type 
# #                     AND status = 'success'::response_status
# #                     """, (rid, prompt_type))

# #                     existing = cur.fetchone()
                    
# #                     if existing:
# #                         print(f"✅ Using cached result for resume {rid}, prompt {prompt_type}")
# #                         content_data = existing["content"]
# #                         if isinstance(content_data, str):
# #                             content_data = json.loads(content_data)
# #                             out.append({
# #                             "resume_id": rid,
# #                             "prompt_type": prompt_type,
# #                             "result": content_data,
# #                             "status": "success"
# #                              })
# #                         continue
# #                     # --- Insert pending row before Gemini call ---
# #                     cur.execute("""
# #                     INSERT INTO gemini_responses (resume_id, response_type, content, status)
# #                     SELECT %s, %s::gemini_response_type, %s::jsonb, 'pending'::response_status
# #                     WHERE EXISTS (SELECT 1 FROM resumes WHERE id = %s)
# #                     ON CONFLICT (resume_id, response_type)
# #                     DO UPDATE SET
# #                     status = 'pending'::response_status,
# #                     created_at = NOW(),
# #                     content = '{}'::jsonb
# #                     """, (rid, prompt_type, json.dumps({}), rid))
 

# #                     # fetch resume text first
# #                     cur.execute("SELECT text_content FROM resumes WHERE id = %s", (rid,))
# #                     row = cur.fetchone()
# #                     resume_text = row["text_content"] if row and "text_content" in row else ""

                   
# #                     user_prompt = user_tmpl.format(jd=job_description_text, resume=resume_text[:20000])
# #                     try:
# #                         explanation_text = generate_text(system_prompt, user_prompt)
# #                         status = "success"
# #                         content_obj = {"text": explanation_text}
# #                     except Exception as e:
# #                         print(f"❌ Ollama processing failed for resume {rid}: {e}")
# #                         status = "failed"
# #                         content_obj = {"error": str(e)}


# #                     temp_results.append((rid, prompt_type, content_obj, status))

# #                             # mark the row as failed
# #                     for rid, ptype, content_obj, status in temp_results:
# #                         cur.execute("""
# #                         INSERT INTO gemini_responses (resume_id, response_type, content, status)
# #                         VALUES (%s, %s::gemini_response_type, %s::jsonb, %s::response_status)
# #                         ON CONFLICT (resume_id, response_type)
# #                         DO UPDATE SET
# #                             content = EXCLUDED.content,
# #                             status = EXCLUDED.status,
# #                             created_at = NOW()
# #                     """, (rid, ptype, json.dumps(content_obj), status))

# #                     out.append({
# #                         "resume_id": rid,
# #                         "prompt_type": ptype,
# #                         "result": content_obj,
# #                         "status": status
# #                     })

# #     except Exception as e:
# #         conn.rollback()
# #         print("❌ shortlist() error:", e)
# #         raise
# #     finally:
# #         put_db(conn)

# #     return out

# from typing import List, Dict, Any
# import json
# import re
# import psycopg2

# from db import get_db, put_db
# from pinecone_client import get_index
# from ollama_client import embed_texts, generate_text


# # ---- PROMPTS ----
# SCORING_SYSTEM = """You are an ATS assistant. Score the candidate resume STRICTLY against the job description.
# Return a single JSON object with fields: score (0-100), strengths (array), gaps (array), summary (string).
# Return JSON only."""

# SCORING_USER_TMPL = """Job Description:
# {jd}

# Candidate Resume:
# {resume}

# Return only valid JSON with exactly these keys:
# {{
#   "score": 0,
#   "strengths": [],
#   "gaps": [],
#   "summary": ""
# }}
# """

# EXPLANATION_SYSTEM = """You are a career assistant. Explain in plain English how well the resume matches the job description."""

# EXPLANATION_USER_TMPL = """Job Description:
# {jd}

# Candidate Resume:
# {resume}

# Write a clear explanation of fit. Do not output JSON.
# """

# EXTRACTION_SYSTEM = """You are an information extractor.
# Extract only facts explicitly supported by the resume.
# Do not guess, infer, estimate, assume, or explain your reasoning.
# If a field cannot be determined directly from the resume, return null or [].
# Return strict JSON only."""

# EXTRACTION_USER_TMPL = """Job Description:
# {jd}

# Candidate Resume:
# {resume}

# Extract structured data from the resume.

# Hard rules:
# 1. Return valid JSON only.
# 2. Do not include markdown fences.
# 3. Do not include explanatory text before or after JSON.
# 4. skills must contain only explicit skills found in the resume.
# 5. experience_years must be null unless total professional experience is explicitly stated or can be calculated confidently from clear work-experience date ranges.
# 6. Do not calculate experience from education dates, current year of study, or graduation year.
# 7. education must be a short resume-based summary, otherwise null.
# 8. relevant_projects must include only resume projects and may be:
#    - string items, or
#    - objects with keys: project_name, technologies_used, description
# 9. Do not invent missing skills, projects, dates, companies, or experience.

# Return exactly this JSON shape:
# {{
#   "skills": [],
#   "experience_years": null,
#   "education": null,
#   "relevant_projects": []
# }}
# """

# SUGGESTION_SYSTEM = """You are a career assistant and ATS optimization expert.
# Analyze the resume against the job description and provide clear, actionable suggestions
# to improve the candidate’s fit for the role.
# Return JSON only."""

# SUGGESTION_USER_TMPL = """Job Description:
# {jd}

# Candidate Resume:
# {resume}

# Based on the job description, suggest improvements for the resume.

# Return a single valid JSON object with the following keys only:
# {{
#   "missing_skills": [],
#   "resume_improvements": [],
#   "project_suggestions": [],
#   "learning_recommendations": [],
#   "overall_advice": ""
# }}
# """


# def extract_json_object(text: str):
#     if not text:
#         return None

#     cleaned = text.strip()
#     cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
#     cleaned = re.sub(r"^```\s*", "", cleaned)
#     cleaned = re.sub(r"\s*```$", "", cleaned)

#     try:
#         return json.loads(cleaned)
#     except Exception:
#         pass

#     start = cleaned.find("{")
#     end = cleaned.rfind("}")
#     if start != -1 and end != -1 and end > start:
#         try:
#             return json.loads(cleaned[start:end + 1])
#         except Exception:
#             return None

#     return None


# def normalize_llm_output(prompt_type: str, raw_text: str):
#     raw_text = (raw_text or "").strip()

#     if prompt_type == "explanation":
#         return {"text": raw_text}

#     parsed = extract_json_object(raw_text)
#     if parsed is not None:
#         return parsed

#     return {"text": raw_text}


# def get_prompt_templates(prompt_type: str):
#     prompt_type = (prompt_type or "scoring").lower()

#     if prompt_type == "explanation":
#         return EXPLANATION_SYSTEM, EXPLANATION_USER_TMPL
#     if prompt_type == "extraction":
#         return EXTRACTION_SYSTEM, EXTRACTION_USER_TMPL
#     if prompt_type == "scoring":
#         return SCORING_SYSTEM, SCORING_USER_TMPL
#     return SUGGESTION_SYSTEM, SUGGESTION_USER_TMPL


# # ---- MAIN FUNCTION ----
# def shortlist(
#     job_id: int,
#     job_description_text: str,
#     top_k: int = 10,
#     rerank: bool = True,
#     prompt_type: str = "scoring",
# ) -> List[Dict[str, Any]]:
#     prompt_type = (prompt_type or "scoring").lower()

#     query_vec = embed_texts([job_description_text])[0]
#     index = get_index()
#     results = index.query(
#         vector=query_vec,
#         top_k=top_k,
#         include_metadata=True,
#         filter={"job_id": int(job_id)},
#     )

#     scores_by_resume = {}
#     for match in results.matches:
#         rid = match.metadata.get("resume_id")
#         if rid is None:
#             continue

#         scores_by_resume.setdefault(rid, {"score": 0.0, "hits": 0, "chunks": []})
#         scores_by_resume[rid]["score"] += match.score or 0.0
#         scores_by_resume[rid]["hits"] += 1
#         scores_by_resume[rid]["chunks"].append(match)

#     ranked = sorted(
#         scores_by_resume.items(),
#         key=lambda kv: kv[1]["score"],
#         reverse=True,
#     )[:top_k]
#     resume_ids = [rid for rid, _ in ranked]

#     if not rerank:
#         return [{"resume_id": rid, "semantic_score": meta["score"]} for rid, meta in ranked]

#     system_prompt, user_tmpl = get_prompt_templates(prompt_type)

#     conn = get_db()
#     out = []

#     try:
#         with conn:
#             with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
#                 if not resume_ids:
#                     return []

#                 cur.execute(
#                     "SELECT id FROM resumes WHERE id = ANY(%s)",
#                     (resume_ids,),
#                 )
#                 valid_ids = {row["id"] for row in cur.fetchall()}
#                 resume_ids = [rid for rid in resume_ids if rid in valid_ids]

#                 for rid in resume_ids:
#                     rid = int(rid)

#                     cur.execute(
#                         """
#                         SELECT content
#                         FROM gemini_responses
#                         WHERE resume_id = %s
#                         AND response_type = %s::gemini_response_type
#                         AND status = 'success'::response_status
#                         """,
#                         (rid, prompt_type),
#                     )

#                     existing = cur.fetchone()
#                     if existing:
#                         print(f"✅ Using cached result for resume {rid}, prompt {prompt_type}")
#                         content_data = existing["content"]

#                         if isinstance(content_data, str):
#                             try:
#                                 content_data = json.loads(content_data)
#                             except Exception:
#                                 content_data = {"text": content_data}

#                         out.append(
#                             {
#                                 "resume_id": rid,
#                                 "prompt_type": prompt_type,
#                                 "result": content_data,
#                                 "status": "success",
#                             }
#                         )
#                         continue

#                     cur.execute(
#                         """
#                         INSERT INTO gemini_responses (resume_id, response_type, content, status)
#                         SELECT %s, %s::gemini_response_type, %s::jsonb, 'pending'::response_status
#                         WHERE EXISTS (SELECT 1 FROM resumes WHERE id = %s)
#                         ON CONFLICT (resume_id, response_type)
#                         DO UPDATE SET
#                             status = 'pending'::response_status,
#                             created_at = NOW(),
#                             content = '{}'::jsonb
#                         """,
#                         (rid, prompt_type, json.dumps({}), rid),
#                     )

#                     cur.execute(
#                         "SELECT text_content FROM resumes WHERE id = %s",
#                         (rid,),
#                     )
#                     row = cur.fetchone()
#                     resume_text = row["text_content"] if row and row.get("text_content") else ""

#                     user_prompt = user_tmpl.format(
#                         jd=job_description_text,
#                         resume=resume_text[:20000],
#                     )

#                     try:
#                         llm_text = generate_text(system_prompt, user_prompt)
#                         content_obj = normalize_llm_output(prompt_type, llm_text)
#                         status = "success"
#                     except Exception as e:
#                         print(f"❌ Ollama processing failed for resume {rid}: {e}")
#                         content_obj = {"error": str(e)}
#                         status = "failed"

#                     cur.execute(
#                         """
#                         INSERT INTO gemini_responses (resume_id, response_type, content, status)
#                         VALUES (%s, %s::gemini_response_type, %s::jsonb, %s::response_status)
#                         ON CONFLICT (resume_id, response_type)
#                         DO UPDATE SET
#                             content = EXCLUDED.content,
#                             status = EXCLUDED.status,
#                             created_at = NOW()
#                         """,
#                         (rid, prompt_type, json.dumps(content_obj), status),
#                     )

#                     out.append(
#                         {
#                             "resume_id": rid,
#                             "prompt_type": prompt_type,
#                             "result": content_obj,
#                             "status": status,
#                         }
#                     )

#     except Exception as e:
#         conn.rollback()
#         print("❌ shortlist() error:", e)
#         raise
#     finally:
#         put_db(conn)

#     return out



from typing import List, Dict, Any
import json
import re
from datetime import datetime
import psycopg2

from db import get_db, put_db
from pinecone_client import get_index
from ollama_client import embed_texts, generate_text


SCORING_SYSTEM = """You are an ATS assistant. Score the candidate resume STRICTLY against the job description.
Return a single JSON object with fields: score (0-100), strengths (array), gaps (array), summary (string).
Return JSON only."""

SCORING_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Return only valid JSON with exactly these keys:
{{
  "score": 0,
  "strengths": [],
  "gaps": [],
  "summary": ""
}}
"""

EXPLANATION_SYSTEM = """You are a career assistant. Explain in plain English how well the resume matches the job description."""
EXPLANATION_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Write a clear explanation of fit. Do not output JSON.
"""

EXTRACTION_SYSTEM = """You are an information extractor.
Extract only facts explicitly supported by the resume.
Do not guess, infer, estimate, assume, or explain your reasoning.
Return strict JSON only."""

EXTRACTION_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Extract structured data from the resume.

Hard rules:
1. Return valid JSON only.
2. Do not include markdown fences.
3. Do not include explanatory text before or after JSON.
4. skills must contain only explicit skills from the resume.
5. experience_years must be based only on professional work-experience date ranges, not education dates.
6. If no valid work-experience range is clearly available, return null for experience_years.
7. education must include all available education details from the resume.
8. education should be an object with keys:
   - name
   - institutions
   - degrees
   - dates
9. relevant_projects must include only resume projects and may contain:
   - project_name
   - technologies_used
   - description

Return exactly this JSON shape:
{{
  "skills": [],
  "experience_years": null,
  "education": {{
    "name": null,
    "institutions": [],
    "degrees": [],
    "dates": []
  }},
  "relevant_projects": []
}}
"""

SUGGESTION_SYSTEM = """You are a career assistant and ATS optimization expert.
Analyze the resume against the job description and provide clear, actionable suggestions
to improve the candidate’s fit for the role.
Return JSON only."""

SUGGESTION_USER_TMPL = """Job Description:
{jd}

Candidate Resume:
{resume}

Based on the job description, suggest improvements for the resume.

Return a single valid JSON object with the following keys only:
{{
  "missing_skills": [],
  "resume_improvements": [],
  "project_suggestions": [],
  "learning_recommendations": [],
  "overall_advice": ""
}}
"""


MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def extract_json_object(text: str):
    if not text:
        return None

    cleaned = text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            return None

    return None


def parse_month_year(value: str):
    if not value:
        return None

    cleaned = value.strip().lower()
    cleaned = cleaned.replace("–", "-")
    cleaned = cleaned.replace("—", "-")
    cleaned = re.sub(r"\s+", " ", cleaned)

    if cleaned in {"present", "current", "till date", "now"}:
        now = datetime.utcnow()
        return datetime(now.year, now.month, 1)

    parts = cleaned.split(" ")
    if len(parts) < 2:
        return None

    month = MONTHS.get(parts[0])
    year_match = re.search(r"\b(19|20)\d{2}\b", cleaned)
    if not month or not year_match:
        return None

    year = int(year_match.group(0))
    return datetime(year, month, 1)


def compute_experience_years_from_resume(text: str):
    if not text:
        return None

    pattern = re.compile(
        r"(?P<start>(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4})\s*[-–—]\s*(?P<end>(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}|Present|Current|Now)",
        re.IGNORECASE,
    )

    ranges = []
    for match in pattern.finditer(text):
        start = parse_month_year(match.group("start"))
        end = parse_month_year(match.group("end"))
        if not start or not end or end < start:
            continue
        ranges.append((start, end))

    if not ranges:
        return None

    ranges.sort(key=lambda item: item[0])

    merged = []
    current_start, current_end = ranges[0]
    for start, end in ranges[1:]:
        if start <= current_end:
            if end > current_end:
                current_end = end
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start, end
    merged.append((current_start, current_end))

    total_months = 0
    for start, end in merged:
        months = (end.year - start.year) * 12 + (end.month - start.month)
        if months > 0:
            total_months += months

    if total_months <= 0:
        return None

    return round(total_months / 12, 1)


def extract_education_from_resume(text: str):
    if not text:
        return {
            "name": None,
            "institutions": [],
            "degrees": [],
            "dates": [],
        }

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    degree_keywords = [
        "master", "bachelor", "b.e", "btech", "b.tech", "mca", "bca",
        "diploma", "engineering", "computer applications", "science"
    ]

    institutions = []
    degrees = []
    dates = []

    date_pattern = re.compile(
        r"(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\s*[-–—]\s*(?:Present|Current|Now|(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4})",
        re.IGNORECASE,
    )

    for line in lines:
        lowered = line.lower()

        if any(keyword in lowered for keyword in degree_keywords):
            if len(line) < 160:
                degrees.append(line)

        if "college" in lowered or "university" in lowered or "institute" in lowered or "school" in lowered:
            if len(line) < 120:
                institutions.append(line)

        for match in date_pattern.findall(line):
            dates.append(match)

    institutions = list(dict.fromkeys(institutions))
    degrees = list(dict.fromkeys(degrees))
    dates = list(dict.fromkeys(dates))

    name = degrees[0] if degrees else None

    return {
        "name": name,
        "institutions": institutions,
        "degrees": degrees,
        "dates": dates,
    }


def normalize_extraction_output(parsed: Dict[str, Any], resume_text: str):
    parsed = parsed or {}

    skills = parsed.get("skills")
    if not isinstance(skills, list):
        skills = []

    experience_years = parsed.get("experience_years")
    if not isinstance(experience_years, (int, float)):
        experience_years = compute_experience_years_from_resume(resume_text)

    education = parsed.get("education")
    if not isinstance(education, dict):
        education = extract_education_from_resume(resume_text)
    else:
        education = {
            "name": education.get("name"),
            "institutions": education.get("institutions") or [],
            "degrees": education.get("degrees") or [],
            "dates": education.get("dates") or [],
        }
        if not education["institutions"] and not education["degrees"] and not education["dates"]:
            education = extract_education_from_resume(resume_text)

    relevant_projects = parsed.get("relevant_projects")
    if not isinstance(relevant_projects, list):
        relevant_projects = []

    return {
        "skills": skills,
        "experience_years": experience_years,
        "education": education,
        "relevant_projects": relevant_projects,
    }


def normalize_llm_output(prompt_type: str, raw_text: str, resume_text: str = ""):
    raw_text = (raw_text or "").strip()

    if prompt_type == "explanation":
        return {"text": raw_text}

    parsed = extract_json_object(raw_text)

    if prompt_type == "extraction":
        return normalize_extraction_output(parsed or {}, resume_text)

    if parsed is not None:
        return parsed

    return {"text": raw_text}


def get_prompt_templates(prompt_type: str):
    prompt_type = (prompt_type or "scoring").lower()

    if prompt_type == "explanation":
        return EXPLANATION_SYSTEM, EXPLANATION_USER_TMPL
    if prompt_type == "extraction":
        return EXTRACTION_SYSTEM, EXTRACTION_USER_TMPL
    if prompt_type == "scoring":
        return SCORING_SYSTEM, SCORING_USER_TMPL
    return SUGGESTION_SYSTEM, SUGGESTION_USER_TMPL


def shortlist(
    job_id: int,
    job_description_text: str,
    top_k: int = 10,
    rerank: bool = True,
    prompt_type: str = "scoring",
) -> List[Dict[str, Any]]:
    prompt_type = (prompt_type or "scoring").lower()

    query_vec = embed_texts([job_description_text])[0]
    index = get_index()
    results = index.query(
        vector=query_vec,
        top_k=top_k,
        include_metadata=True,
        filter={"job_id": int(job_id)},
    )

    scores_by_resume = {}
    for match in results.matches:
        rid = match.metadata.get("resume_id")
        if rid is None:
            continue

        scores_by_resume.setdefault(rid, {"score": 0.0, "hits": 0, "chunks": []})
        scores_by_resume[rid]["score"] += match.score or 0.0
        scores_by_resume[rid]["hits"] += 1
        scores_by_resume[rid]["chunks"].append(match)

    ranked = sorted(
        scores_by_resume.items(),
        key=lambda kv: kv[1]["score"],
        reverse=True,
    )[:top_k]
    resume_ids = [rid for rid, _ in ranked]

    if not rerank:
        return [{"resume_id": rid, "semantic_score": meta["score"]} for rid, meta in ranked]

    system_prompt, user_tmpl = get_prompt_templates(prompt_type)

    conn = get_db()
    out = []

    try:
        with conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if not resume_ids:
                    return []

                cur.execute("SELECT id FROM resumes WHERE id = ANY(%s)", (resume_ids,))
                valid_ids = {row["id"] for row in cur.fetchall()}
                resume_ids = [rid for rid in resume_ids if rid in valid_ids]

                for rid in resume_ids:
                    rid = int(rid)

                    cur.execute(
                        """
                        SELECT content
                        FROM gemini_responses
                        WHERE resume_id = %s
                        AND response_type = %s::gemini_response_type
                        AND status = 'success'::response_status
                        """,
                        (rid, prompt_type),
                    )
                    existing = cur.fetchone()

                    if existing:
                        content_data = existing["content"]
                        if isinstance(content_data, str):
                            try:
                                content_data = json.loads(content_data)
                            except Exception:
                                content_data = {"text": content_data}

                        out.append(
                            {
                                "resume_id": rid,
                                "prompt_type": prompt_type,
                                "result": content_data,
                                "status": "success",
                            }
                        )
                        continue

                    cur.execute(
                        """
                        INSERT INTO gemini_responses (resume_id, response_type, content, status)
                        SELECT %s, %s::gemini_response_type, %s::jsonb, 'pending'::response_status
                        WHERE EXISTS (SELECT 1 FROM resumes WHERE id = %s)
                        ON CONFLICT (resume_id, response_type)
                        DO UPDATE SET
                            status = 'pending'::response_status,
                            created_at = NOW(),
                            content = '{}'::jsonb
                        """,
                        (rid, prompt_type, json.dumps({}), rid),
                    )

                    cur.execute("SELECT text_content FROM resumes WHERE id = %s", (rid,))
                    row = cur.fetchone()
                    resume_text = row["text_content"] if row and row.get("text_content") else ""

                    user_prompt = user_tmpl.format(
                        jd=job_description_text,
                        resume=resume_text[:20000],
                    )

                    try:
                        llm_text = generate_text(system_prompt, user_prompt)
                        content_obj = normalize_llm_output(prompt_type, llm_text, resume_text)
                        status = "success"
                    except Exception as e:
                        print(f"❌ Ollama processing failed for resume {rid}: {e}")
                        content_obj = {"error": str(e)}
                        status = "failed"

                    cur.execute(
                        """
                        INSERT INTO gemini_responses (resume_id, response_type, content, status)
                        VALUES (%s, %s::gemini_response_type, %s::jsonb, %s::response_status)
                        ON CONFLICT (resume_id, response_type)
                        DO UPDATE SET
                            content = EXCLUDED.content,
                            status = EXCLUDED.status,
                            created_at = NOW()
                        """,
                        (rid, prompt_type, json.dumps(content_obj), status),
                    )

                    out.append(
                        {
                            "resume_id": rid,
                            "prompt_type": prompt_type,
                            "result": content_obj,
                            "status": status,
                        }
                    )

    except Exception as e:
        conn.rollback()
        print("❌ shortlist() error:", e)
        raise
    finally:
        put_db(conn)

    return out
