from flask import Blueprint, request, jsonify
from psycopg2 import extras
from dotenv import load_dotenv
from db import get_db

load_dotenv()

user_bp = Blueprint('user_routes', __name__)
    
@user_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    user_id = data.get('uid') 
    email = data.get('email')

    if not user_id or not email:
        return jsonify({"error": "uid and email are required"}), 400

    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO users (user_id, email)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id) DO NOTHING;
                """, (user_id, email))
                conn.commit()

                if cur.rowcount > 0:
                    return jsonify({"message": "User created successfully"}), 201
                else:
                    return jsonify({"message": "User already exists"}), 200

    except Exception as e:
        print("DB Error:", str(e))
        return jsonify({"error": "Internal server error"}), 500

