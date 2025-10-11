from flask import Flask, jsonify
from flask_cors import CORS
from routes.user_routes import user_bp
from routes.jobs_routes import jobs_bp
from routes.resume_routes import resumes_bp
from routes.results_routes import results_bp
from pinecone_client import get_index
from dotenv import load_dotenv


# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, allow_headers=["Content-Type", "Authorization"])



# Connect to Pinecone
index = get_index()


# Register blueprint
app.register_blueprint(user_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(resumes_bp)
app.register_blueprint(results_bp)




# Run the app
if __name__ == '__main__':
    app.run(debug=True,port=8080)
