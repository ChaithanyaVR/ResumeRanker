import os
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

@jobs_bp.route("/jobs-with-resumes", methods=["POST"])
def create_job_with_resumes():
    """
    Create a job AND upload resumes in a single transaction.
    If resumes fail → job is NOT created.
    """
    data = request.form or {}
    user_id = data.get("user_id")
    job_title = data.get("job_title")
    job_description = data.get("job_description")

    if not all([user_id, job_title, job_description]):
        return jsonify({"error": "user_id, job_title, job_description are required"}), 400

    if "files" not in request.files:
        return jsonify({"error": "resumes (files) are required"}), 400

    to_images = (request.form.get("to_images", "false").lower() == "true")

    conn = get_db()
    try:
        with conn, conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            # Step 1: Create job
            cur.execute("""
                INSERT INTO jobs (user_id, job_title, job_description)
                VALUES (%s, %s, %s)
                RETURNING job_id
            """, (user_id, job_title, job_description))
            job_id = cur.fetchone()["job_id"]

            saved = []

            # Step 2: Process resumes
            for f in request.files.getlist("files"):
                fname = secure_filename(f.filename)
                path = os.path.join(UPLOAD_DIR, fname)
                f.save(path)

                text = extract_text_from_pdf(path)
                parse_status = "ok" if text else "failed"

                cur.execute("""
                    INSERT INTO resumes (filename, file_path, text_content, parse_status, job_id)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (fname, path, text, parse_status, job_id))
                row = cur.fetchone()
                if not row:
                    raise Exception("Insert failed, no row returned")
                resume_id = row["id"]

                if to_images:
                    img_dir = os.path.join(UPLOAD_DIR, f"resume_{resume_id}_pages")
                    pdf_to_images(path, img_dir)

                if parse_status == "ok":
                    upsert_resume_to_pinecone(resume_id, text, int(job_id))

                saved.append({
                    "resume_id": resume_id,
                    "filename": fname,
                    "parse_status": parse_status
                })

            # ✅ Commit both job + resumes if everything worked
            conn.commit()
            return jsonify({"job_id": job_id, "uploaded": saved}), 201

    except Exception as e:
        conn.rollback()  # ❌ Rollback if resumes failed
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
