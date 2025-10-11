from typing import Iterable
from db import get_db, put_db
from pinecone_client import get_index
from gemini_client import embed_texts

# simple splitter
def simple_chunks(text: str, max_chars=1200, overlap=150) -> list[str]:
    text = text or ""
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        chunk = text[i:i+max_chars]
        chunks.append(chunk)
        i += max(1, max_chars - overlap)
    return [c for c in chunks if c.strip()]

def upsert_resume_to_pinecone(resume_id: int, full_text: str, job_id: int):
    chunks = simple_chunks(full_text)
    vectors = embed_texts(chunks)
    index = get_index()

    # ✅ new tuple format for Pinecone v7
    items = []
    for idx, vec in enumerate(vectors):
        pine_id = f"resume:{resume_id}:chunk:{idx}"
        metadata = {
            "resume_id": resume_id,
            "chunk_index": idx,
            "job_id": int(job_id)
        }
        items.append((pine_id, vec, metadata))

    # upsert to pinecone
    index.upsert(vectors=items)

    # store chunk rows in DB
    conn = get_db()
    try:
        with conn, conn.cursor() as cur:
            for idx, chunk in enumerate(chunks):
                pine_id = f"resume:{resume_id}:chunk:{idx}"
                cur.execute("""
                    INSERT INTO resume_chunks (resume_id, chunk_index, text, pinecone_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (pinecone_id) DO NOTHING
                """, (resume_id, idx, chunk, pine_id))
    finally:
        put_db(conn)
