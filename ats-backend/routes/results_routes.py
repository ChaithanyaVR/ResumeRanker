import json
import traceback
from flask import Blueprint, request, jsonify
from psycopg2 import extras
from db import get_db, put_db

# Create blueprint
results_bp = Blueprint("results_routes", __name__)

@results_bp.route("/gemini-responses", methods=["GET"])
def get_gemini_responses():
    """
    Fetch Gemini responses for a given job_id and optional prompt_type.
    Query Params:
      - job_id (required)
      - prompt_type (optional)
    Returns JSON:
      {
        "results": [
          {
            "resume_id": 1,
            "response_type": "scoring",
            "content": {...},
            "status": "success",
            "filename": "resume1.pdf"
          },
          ...
        ]
      }
    """
    job_id = request.args.get("job_id", type=int)
    prompt_type = request.args.get("prompt_type")

    if not job_id:
        return jsonify({"error": "job_id is required"}), 400

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            query = """
                SELECT 
                    g.resume_id,
                    g.response_type,
                    g.content,
                    g.status,
                    g.created_at,
                    r.filename,
                    r.job_id
                FROM gemini_responses g
                JOIN resumes r ON g.resume_id = r.id
                WHERE r.job_id = %s
            """
            params = [job_id]

            if prompt_type:
                query += " AND g.response_type = %s::gemini_response_type"
                params.append(prompt_type)

            query += " ORDER BY g.created_at DESC"

            cur.execute(query, tuple(params))
            results = cur.fetchall()

            # Safely parse JSON in 'content' field
            for row in results:
                if isinstance(row.get("content"), str):
                    try:
                        row["content"] = json.loads(row["content"])
                    except Exception:
                        pass

            return jsonify({"results": results}), 200

    except Exception as e:
        print("❌ Error (get_gemini_responses):", e)
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch gemini responses"}), 500

    finally:
        put_db(conn)
