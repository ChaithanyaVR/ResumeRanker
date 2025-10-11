import os
from google import genai
import random
import time
from google.genai import types
from google.api_core.exceptions import ResourceExhausted
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

EMBED_MODEL = "gemini-embedding-001"  # embedding model
GEN_MODEL = "gemini-pro-latest"
       

def embed_texts(texts: list[str], dim: int = 1536) -> list[list[float]]:
    """
    Embed a list of texts with Gemini embeddings API.
    Returns a list of float vectors (one per text) of specified dimensionality.
    """
    if isinstance(texts, str):
        texts = [texts]

    out = []
    print("DEBUG: Gemini embedding call START =================")
    print("DEBUG: number of texts to embed =", len(texts))

    for i, t in enumerate(texts):
        result = client.models.embed_content(
            model=EMBED_MODEL,
            contents=t,
            config=types.EmbedContentConfig(output_dimensionality=dim)  # control embedding size
        )
        embedding_obj = result.embeddings[0]
        vec = embedding_obj.values
        print(f"\nDEBUG: embedding length for text[{i}] =", len(vec))
        out.append(vec)

    print("DEBUG: Gemini embedding call END ===================\n")
    return out

def generate_text(system_prompt: str, user_prompt: str) -> str:
    """
    Call Gemini *once* (no retries). Merges system and user prompts into a single input.
    """
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    try:
        resp = client.models.generate_content(
            model=GEN_MODEL,
            contents=full_prompt
        )
        return resp.text.strip() if hasattr(resp, "text") and resp.text else ""
    except ResourceExhausted as e:
        # Fail fast if API is overloaded
        print(f"⚠️ Gemini quota exceeded: {e}")
        raise
    except Exception as e:
        print(f"❌ Gemini text generation error: {e}")
        raise