from flask import Blueprint, request, jsonify
import os
from psycopg2 import connect, extras
from dotenv import load_dotenv

load_dotenv()

user_bp = Blueprint('user_routes', __name__)

# DB connection
conn = connect(os.getenv("DATABASE_URL"))
conn.autocommit = True

@user_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    user_id = data.get('uid')
    email = data.get('email')

    if not user_id or not email:
        return jsonify({"error": "uid and email are required"}), 400

    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO users (user_id, email)
                VALUES (%s, %s)
                ON CONFLICT (user_id) DO NOTHING;
            """, (user_id, email))
        return jsonify({"message": "User inserted"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


