"""Traffic-law PDF → มาตรา-aware chunks → vector store."""
import re
from dataclasses import dataclass

MAX_CHUNK_CHARS = 1200
OVERLAP_CHARS = 150

# มาตรา + Thai or Arabic digits, e.g. "มาตรา ๑๒" / "มาตรา 15" / "มาตรา ๑๕/๑"
SECTION_RE = re.compile(r"(?=มาตรา\s*[๐-๙0-9]+)")


@dataclass
class Chunk:
    section: str
    text: str


def _section_label(text: str) -> str:
    m = re.match(r"มาตรา\s*([๐-๙0-9/]+)", text)
    return f"มาตรา {m.group(1)}" if m else ""


def _split_long(text: str):
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    parts = []
    start = 0
    while start < len(text):
        parts.append(text[start:start + MAX_CHUNK_CHARS])
        if start + MAX_CHUNK_CHARS >= len(text):
            break
        start += MAX_CHUNK_CHARS - OVERLAP_CHARS
    return parts


def chunk_law_text(text: str) -> list:
    """Split Thai legal text on มาตรา headers; fall back to paragraphs."""
    text = re.sub(r"[ \t]+", " ", text).strip()
    pieces = [p.strip() for p in SECTION_RE.split(text) if p.strip()]
    chunks = []
    if len(pieces) <= 1 and "มาตรา" not in text:
        for para in re.split(r"\n{2,}", text):
            para = para.strip()
            if len(para) < 30:
                continue
            for part in _split_long(para):
                chunks.append(Chunk(section="", text=part))
        return chunks
    for piece in pieces:
        label = _section_label(piece)
        for part in _split_long(piece):
            chunks.append(Chunk(section=label, text=part))
    return chunks


def extract_pdf_text(pdf_path) -> str:
    import fitz  # pymupdf

    doc = fitz.open(pdf_path)
    pages = [page.get_text("text") for page in doc]
    doc.close()
    return "\n".join(pages)
