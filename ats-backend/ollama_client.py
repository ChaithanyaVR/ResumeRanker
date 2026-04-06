# ollama_client.py

from typing import List
import ollama
from sentence_transformers import SentenceTransformer

# -------------------------------
# TEXT GENERATION (Ollama LLM)
# -------------------------------

def generate_text(system_prompt: str, user_prompt: str, model: str = "llama3.2:3b") -> str:
    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}   
        ]
    )
    return response["message"]["content"]


# -------------------------------
# EMBEDDINGS (Local model)
# -------------------------------

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
EMBED_DIM = 384

def embed_texts(texts: List[str], dim: int = EMBED_DIM) -> List[List[float]]:
    if isinstance(texts, str):
        texts = [texts]

    print("DEBUG: Local embedding START =================")
    print("DEBUG: number of texts to embed =", len(texts))

    vectors = embed_model.encode(texts, convert_to_numpy=True).tolist()

    if vectors and dim and len(vectors[0]) != dim:
        print(f"⚠️ Warning: embedding dim is {len(vectors[0])}, expected {dim}")

    print("DEBUG: Local embedding END ===================\n")
    return vectors
