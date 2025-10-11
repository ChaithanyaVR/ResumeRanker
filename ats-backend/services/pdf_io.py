#PDF → text (+ images) service
import os
from pdf2image import convert_from_path
from PyPDF2 import PdfReader
from PIL import Image

def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    pages = []
    for p in reader.pages:
        try:
            pages.append(p.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages).strip()

def pdf_to_images(path: str, out_dir: str) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    images = convert_from_path(path)  # requires poppler
    saved = []
    for i, img in enumerate(images):
        out_path = os.path.join(out_dir, f"page_{i+1}.png")
        img = img.convert("RGB")  # optional preprocessing hooks here
        img.save(out_path, "PNG")
        saved.append(out_path)
    return saved
