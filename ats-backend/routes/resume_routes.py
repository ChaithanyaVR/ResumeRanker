# routes/resume_routes.py (modified upload_resumes)
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from psycopg2 import extras
from db import get_db, put_db
import traceback
import json
from typing import Any
from services.pdf_io import extract_text_from_pdf, pdf_to_images
from services.resume_indexer import upsert_resume_to_pinecone
from services.shortlist import shortlist
from google.api_core.exceptions import ResourceExhausted


resumes_bp = Blueprint("resumes_routes", __name__)


@resumes_bp.route("/shortlist", methods=["POST"])
def shortlist_route():
    results = []
    try:
        data = request.get_json() or {}
        job_id = data.get("job_id")
        top_k = int(data.get("top_k", 10))
        rerank = bool(data.get("rerank", True))
        prompt_type = data.get("prompt_type", "explanation")

        if not job_id:
            return jsonify({"error": "job_id is required"}), 400

        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT job_description FROM jobs WHERE job_id = %s", (job_id,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "job_description not found"}), 404
                jd_text = row[0] if isinstance(row, tuple) else row.get("job_description", row[0])
        finally:
            put_db(conn)
        try:
            results = shortlist(
                job_id=job_id,
                job_description_text=jd_text,
                top_k=top_k,
                rerank=rerank,
                prompt_type=prompt_type
            )
            print("results",results)
        except ResourceExhausted as re:
            # AI is overloaded — return 503. gemini_responses rows for processed resumes
            print("AI model overloaded:", re)
            traceback.print_exc()
            return jsonify({"error": "AI model overloaded. Please try again later."}), 503

        for i, r in enumerate(results):
            if isinstance(r.get("result"), str):
                try:
                    results[i]["result"] = json.loads(r["result"])
                except Exception:
                    # fallback if parsing fails
                    results[i]["result"] = {"text": r["result"]}

        print(f"✅ Returning {len(results)} results")
        return jsonify({"results": results}), 200
        
    except Exception as e:
        print("❌ Shortlist error:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500