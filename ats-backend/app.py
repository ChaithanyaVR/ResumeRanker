from flask import Flask
from flask_cors import CORS
from routes.user_routes import user_bp


# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])


# Register blueprint
app.register_blueprint(user_bp)


# Run the app
if __name__ == '__main__':
    app.run(debug=True,port=8080)
