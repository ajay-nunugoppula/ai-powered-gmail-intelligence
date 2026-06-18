import re
import html2text
from bs4 import BeautifulSoup


def html_to_text(html: str) -> str:
    if not html:
        return ""
    try:
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.body_width = 0
        return h.handle(html).strip()
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
        return soup.get_text(separator="\n", strip=True)


def clean_email_body(text: str, max_length: int = 10000) -> str:
    if not text:
        return ""
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    if len(text) > max_length:
        text = text[:max_length] + "..."
    return text.strip()


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end < len(text):
            break_point = text.rfind("\n", start + chunk_size // 2, end)
            if break_point == -1:
                break_point = text.rfind(" ", start + chunk_size // 2, end)
            if break_point > start:
                end = break_point
        chunks.append(text[start:end].strip())
        start = end - overlap if end < len(text) else end

    return [c for c in chunks if c]


def parse_email_address(raw: str) -> tuple[str, str]:
    """Parse 'Name <email@domain.com>' into (name, email)."""
    if not raw:
        return ("", "")
    match = re.match(r"^(?:(.+?)\s*)?<([^>]+)>", raw.strip())
    if match:
        name = (match.group(1) or "").strip().strip('"')
        return (name, match.group(2).strip())
    return ("", raw.strip())


def extract_newsletter_items(text: str) -> list[dict]:
    """Extract news items from newsletter email body."""
    items = []
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        if not line or len(line) < 20:
            continue
        url_match = re.search(r"https?://[^\s<>\"]+", line)
        if url_match or (line.startswith("-") or line.startswith("*") or line.startswith("•")):
            title = re.sub(r"^[-*•]\s*", "", line)
            title = re.sub(r"https?://[^\s<>\"]+", "", title).strip()
            if len(title) > 15:
                items.append({
                    "title": title[:200],
                    "url": url_match.group(0) if url_match else None,
                })
    return items[:20]
