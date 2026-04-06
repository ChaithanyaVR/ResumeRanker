from pinecone import Pinecone
import os
from dotenv import load_dotenv

load_dotenv()

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = os.getenv("PINECONE_INDEX", "resumes")

EMBED_DIM = 384  # 🔥 must match SentenceTransformer

existing_indexes = [i["name"] for i in pc.list_indexes()]

# ❗ If index exists with wrong dimension, delete it from Pinecone console first
if index_name not in existing_indexes:
    pc.create_index(
        name=index_name,
        dimension=EMBED_DIM,
        metric="cosine",
        spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
    )
    print(f"Created index {index_name} with dimension {EMBED_DIM}")

index = pc.Index(index_name)

def get_index():
    return index