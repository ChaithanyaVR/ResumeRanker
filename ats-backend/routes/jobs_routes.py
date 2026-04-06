import os
import re
from flask import Blueprint, request, jsonify
from psycopg2 import extras
from db import get_db, put_db
from werkzeug.utils import secure_filename
import traceback
from services.pdf_io import extract_text_from_pdf, pdf_to_images
from services.resume_indexer import upsert_resume_to_pinecone

jobs_bp = Blueprint("jobs_routes", __name__)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def extract_resume_keywords(text, limit=12):
    if not text:
        return []

    stop_words = {
        "the", "and", "for", "with", "that", "this", "from", "your", "have",
        "has", "were", "was", "are", "but", "not", "you", "our", "their",
        "will", "into", "than", "then", "they", "them", "his", "her", "she",
        "him", "its", "job", "role", "work", "used", "using", "use", "all",
        "can", "also", "one", "two", "three", "over", "under", "such", "only",
        "more", "most", "very", "each", "per", "any", "out", "may", "pdf",
        "resume", "candidate"
    }

    counts = {}
    for word in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", text.lower()):
        if word in stop_words:
            continue
        counts[word] = counts.get(word, 0) + 1

    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word for word, _ in ranked[:limit]]

def build_resume_signature(filename, text_content, file_path):
    normalized_name = (filename or "").strip().lower()
    normalized_path = os.path.basename(file_path or "").strip().lower()
    normalized_text = re.sub(r"\s+", " ", (text_content or "").strip().lower())[:2000]
    return f"{normalized_name}|{normalized_path}|{normalized_text}"


@jobs_bp.route("/repository-resumes", methods=["GET"])
def get_repository_resumes():
    user_id = request.args.get("user_id")
    search = (request.args.get("search") or "").strip().lower()

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    r.id,
                    r.filename,
                    r.file_path,
                    r.parse_status,
                    r.text_content,
                    r.job_id
                FROM resumes r
                JOIN jobs j ON j.job_id = r.job_id
                WHERE j.user_id = %s
                ORDER BY r.id DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()

        seen = set()
        unique_resumes = []

        for row in rows:
            filename = row["filename"] or ""
            text_content = row.get("text_content") or ""
            file_path = row.get("file_path") or ""
            signature = build_resume_signature(filename, text_content, file_path)

            if signature in seen:
                continue
            seen.add(signature)

            keywords = extract_resume_keywords(text_content)
            searchable_text = " ".join(
                part for part in [filename, text_content, " ".join(keywords)] if part
            ).lower()

            if search and search not in searchable_text:
                continue

            unique_resumes.append(
                {
                    "id": row["id"],
                    "title": filename,
                    "filename": filename,
                    "file_path": file_path,
                    "parse_status": row["parse_status"],
                    "job_id": row["job_id"],
                    "keywords": keywords,
                    "searchable_text": searchable_text,
                }
            )

        return jsonify({"resumes": unique_resumes}), 200

    except Exception as e:
        print("Error (get_repository_resumes):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch repository resumes"}), 500
    finally:
        put_db(conn)



@jobs_bp.route("/jobs-with-resumes", methods=["POST"])
def create_job_with_resumes():
    """
    Create a job and attach resumes from uploaded files, repository selection, or both.
    """
    data = request.form or {}

    user_id = data.get("user_id")
    job_title = data.get("job_title")
    job_description = data.get("job_description")
    repository_resume_ids = [
        int(value)
        for value in request.form.getlist("repository_resume_ids")
        if str(value).strip().isdigit()
    ]

    if not all([user_id, job_title, job_description]):
        return jsonify({"error": "user_id, job_title, job_description are required"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files and not repository_resume_ids:
        return jsonify({"error": "Please upload resumes or select resumes from repository"}), 400

    to_images = request.form.get("to_images", "false").lower() == "true"

    conn = get_db()
    try:
        with conn, conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO jobs (user_id, job_title, job_description)
                VALUES (%s, %s, %s)
                RETURNING job_id
                """,
                (user_id, job_title, job_description),
            )
            job_id = cur.fetchone()["job_id"]
            saved = []

            for f in uploaded_files:
                fname = secure_filename(f.filename)
                path = os.path.join(UPLOAD_DIR, fname)
                f.save(path)

                text = extract_text_from_pdf(path)
                parse_status = "ok" if text else "failed"

                cur.execute(
                    """
                    INSERT INTO resumes (filename, file_path, text_content, parse_status, job_id)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (fname, path, text, parse_status, job_id),
                )
                row = cur.fetchone()
                if not row:
                    raise Exception("Insert failed, no row returned")

                resume_id = row["id"]

                if to_images:
                    img_dir = os.path.join(UPLOAD_DIR, f"resume_{resume_id}_pages")
                    pdf_to_images(path, img_dir)

                if parse_status == "ok":
                    upsert_resume_to_pinecone(resume_id, text, int(job_id), cur)

                saved.append(
                    {
                        "resume_id": resume_id,
                        "filename": fname,
                        "parse_status": parse_status,
                        "source": "upload",
                    }
                )

            if repository_resume_ids:
                cur.execute(
                    """
                    SELECT
                        r.id,
                        r.filename,
                        r.file_path,
                        r.text_content,
                        r.parse_status
                    FROM resumes r
                    JOIN jobs j ON j.job_id = r.job_id
                    WHERE r.id = ANY(%s) AND j.user_id = %s
                    """,
                    (repository_resume_ids, user_id),
                )
                source_rows = cur.fetchall()

                found_ids = {row["id"] for row in source_rows}
                missing_ids = [rid for rid in repository_resume_ids if rid not in found_ids]
                if missing_ids:
                    return jsonify({"error": "Some repository resumes were not found"}), 404

                for row in source_rows:
                    cur.execute(
                        """
                        INSERT INTO resumes (filename, file_path, text_content, parse_status, job_id)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            row["filename"],
                            row["file_path"],
                            row["text_content"],
                            row["parse_status"],
                            job_id,
                        ),
                    )
                    cloned_resume_id = cur.fetchone()["id"]

                    if row["parse_status"] == "ok" and row["text_content"]:
                        upsert_resume_to_pinecone(
                            cloned_resume_id,
                            row["text_content"],
                            int(job_id),
                            cur,
                        )

                    saved.append(
                        {
                            "resume_id": cloned_resume_id,
                            "filename": row["filename"],
                            "parse_status": row["parse_status"],
                            "source": "repository",
                            "source_resume_id": row["id"],
                        }
                    )

            return jsonify({"job_id": job_id, "uploaded": saved}), 201

    except Exception as e:
        print("Error (create_job_with_resumes):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to create job with resumes"}), 500
    finally:
        put_db(conn)



@jobs_bp.route("/job-details/<int:job_id>", methods=["GET"])
def get_job_with_resumes(job_id):
    """
    Fetch a job along with its resumes based on job_id.
    Returns:
    {
        "job_id": ...,
        "job_title": "...",
        "job_description": "...",
        "resumes": [
            {"resume_id": 1, "filename": "file1.pdf", "file_path": "...", "parse_status": "ok"},
            ...
        ]
    }
    """
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            # Step 1: Fetch job details
            cur.execute("""
                SELECT job_id, job_title, job_description
                FROM jobs
                WHERE job_id = %s
            """, (job_id,))
            job = cur.fetchone()
            if not job:
                return jsonify({"error": "Job not found"}), 404

            # Step 2: Fetch associated resumes
            cur.execute("""
                SELECT id AS resume_id, filename, file_path, parse_status
                FROM resumes
                WHERE job_id = %s
                ORDER BY id
            """, (job_id,))
            resumes = cur.fetchall()

            job["resumes"] = resumes
            return jsonify(job), 200

    except Exception as e:
        print("Error (get_job_with_resumes):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch job with resumes"}), 500

    finally:
        put_db(conn)




@jobs_bp.route("/jobs-history", methods=["GET"])
def get_jobs_history():
    user_id = request.args.get("user_id")
    page = max(request.args.get("page", default=1, type=int), 1)
    limit = max(min(request.args.get("limit", default=10, type=int), 50), 1)
    offset = (page - 1) * limit

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM jobs
                WHERE user_id = %s
                """,
                (user_id,),
            )
            total = cur.fetchone()["total"]

            cur.execute(
                """
                SELECT
                    j.job_id,
                    j.job_title,
                    j.job_description,
                    j.created_at,
                    COALESCE(MAX(g.created_at), j.created_at) AS updated_at,
                    COUNT(DISTINCT r.id) AS resume_count,
                    COUNT(DISTINCT CASE WHEN g.status = 'success' THEN g.resume_id END) AS processed_count,
                    COUNT(DISTINCT CASE WHEN g.status = 'failed' THEN g.resume_id END) AS failed_count
                FROM jobs j
                LEFT JOIN resumes r ON r.job_id = j.job_id
                LEFT JOIN gemini_responses g ON g.resume_id = r.id
                WHERE j.user_id = %s
                GROUP BY j.job_id, j.job_title, j.job_description, j.created_at
                ORDER BY j.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (user_id, limit, offset),
            )
            rows = cur.fetchall()

            items = []
            for row in rows:
                status = "Ready"
                if row["failed_count"] > 0 and row["processed_count"] == 0:
                    status = "Failed"
                elif row["processed_count"] == 0:
                    status = "Processing"

                items.append(
                    {
                        "job_id": row["job_id"],
                        "job_title": row["job_title"],
                        "job_description": row["job_description"],
                        "resume_count": row["resume_count"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "status": status,
                    }
                )

            return jsonify(
                {
                    "items": items,
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "total_pages": (total + limit - 1) // limit,
                }
            ), 200

    except Exception as e:
        print("Error (get_jobs_history):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch jobs history"}), 500
    finally:
        put_db(conn)


@jobs_bp.route("/jobs-history/<int:job_id>", methods=["DELETE"])
def delete_job_history(job_id):
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conn = get_db()
    try:
        with conn, conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT job_id
                FROM jobs
                WHERE job_id = %s AND user_id = %s
                """,
                (job_id, user_id),
            )
            job = cur.fetchone()
            if not job:
                return jsonify({"error": "Job not found"}), 404

            cur.execute("SELECT id FROM resumes WHERE job_id = %s", (job_id,))
            resume_rows = cur.fetchall()
            resume_ids = [row["id"] for row in resume_rows]

            if resume_ids:
                cur.execute(
                    "DELETE FROM gemini_responses WHERE resume_id = ANY(%s)",
                    (resume_ids,),
                )
                cur.execute(
                    "DELETE FROM resume_chunks WHERE resume_id = ANY(%s)",
                    (resume_ids,),
                )
                cur.execute(
                    "DELETE FROM resumes WHERE id = ANY(%s)",
                    (resume_ids,),
                )

            cur.execute("DELETE FROM jobs WHERE job_id = %s", (job_id,))
            return jsonify({"message": "Job history deleted successfully"}), 200

    except Exception as e:
        print("Error (delete_job_history):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to delete job history"}), 500
    finally:
        put_db(conn)

