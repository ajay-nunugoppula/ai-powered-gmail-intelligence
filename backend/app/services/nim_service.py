import logging
from typing import Optional
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


class NIMService:
    """NVIDIA NIM service for embeddings and lightweight inference."""

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.nim_api_key
        self.base_url = settings.nim_base_url
        self.model = settings.nim_model
        self.embedding_model = settings.nim_embedding_model

    async def generate_embedding(self, text: str) -> Optional[list[float]]:
        if not self.api_key or not text.strip():
            return None

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.embedding_model,
                        "input": [text[:8000]],
                        "input_type": "query",
                        "encoding_format": "float",
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]
        except Exception as e:
            logger.error(f"NIM embedding error: {e}")
            return None

    async def generate_embeddings_batch(self, texts: list[str]) -> list[Optional[list[float]]]:
        if not self.api_key or not texts:
            return [None] * len(texts)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.embedding_model,
                        "input": [t[:8000] for t in texts],
                        "input_type": "passage",
                        "encoding_format": "float",
                    },
                )
                response.raise_for_status()
                data = response.json()
                sorted_data = sorted(data["data"], key=lambda x: x["index"])
                return [item["embedding"] for item in sorted_data]
        except Exception as e:
            logger.error(f"NIM batch embedding error: {e}")
            return [None] * len(texts)

    async def classify_email(self, subject: str, sender: str, snippet: str) -> dict:
        """Use NIM for fast email categorization."""
        if not self.api_key:
            return {"category": "uncategorized", "confidence": 0.0}

        prompt = f"""Classify this email into exactly one category.
Categories: newsletters, job_recruitment, finance, notifications, personal, work_professional

Email:
From: {sender}
Subject: {subject}
Preview: {snippet[:300]}

Respond with ONLY a JSON object: {{"category": "<category>", "confidence": <0.0-1.0>}}"""

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "max_tokens": 100,
                    },
                )
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"].strip()
                import json
                if "{" in content:
                    json_str = content[content.index("{"):content.rindex("}") + 1]
                    return json.loads(json_str)
        except Exception as e:
            logger.error(f"NIM classification error: {e}")

        return {"category": "uncategorized", "confidence": 0.0}

    async def deduplicate_news_items(self, items: list[dict]) -> list[dict]:
        """Use NIM embeddings to deduplicate semantically similar news items."""
        if len(items) <= 1:
            return items

        texts = [item.get("title", "") for item in items]
        embeddings = await self.generate_embeddings_batch(texts)

        valid_items = []
        valid_embeddings = []
        for item, emb in zip(items, embeddings):
            if emb:
                valid_items.append(item)
                valid_embeddings.append(emb)

        if not valid_items:
            return items

        deduplicated = []
        used = set()
        threshold = 0.85

        for i, (item, emb_i) in enumerate(zip(valid_items, valid_embeddings)):
            if i in used:
                continue

            group = [item]
            sources = [item.get("source_name", "Unknown")]

            for j in range(i + 1, len(valid_items)):
                if j in used:
                    continue
                similarity = self._cosine_similarity(emb_i, valid_embeddings[j])
                if similarity >= threshold:
                    group.append(valid_items[j])
                    sources.append(valid_items[j].get("source_name", "Unknown"))
                    used.add(j)

            merged = {**item, "sources": list(set(sources)), "source_count": len(set(sources))}
            deduplicated.append(merged)
            used.add(i)

        return deduplicated

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)
