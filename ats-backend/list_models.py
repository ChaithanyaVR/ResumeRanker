import os
import requests

API_KEY = os.getenv("GOOGLE_API_KEY")
url = "https://genai.googleapis.com/v1/models"  # use v1, not v1beta
headers = {"Authorization": f"Bearer {API_KEY}"}

resp = requests.get(url, headers=headers)
print("Status code:", resp.status_code)
print("Raw response text:", resp.text)

if resp.text:
    models = resp.json()
    print("Available models:")
    for m in models.get("models", []):
        print(m.get("name"), m.get("supportedMethods"))
else:
    print("Empty response. Check API key and endpoint.")
