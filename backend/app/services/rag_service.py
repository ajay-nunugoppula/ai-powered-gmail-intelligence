import logging
from typing import Optional
from app.services.nim_service import NIMService
from app.models.database import get_supabase
from app.utils.text_utils import chunk_text

logger = logging.getLogger(__name__)


class RAGService:
    """Retrieval-Augmented Generation pipeline for email knowledge base."""

    def __init__(self):
        self.nim = NIMService()
        self.db = get_supabase()

    async def index_email(self, email_id: str, user_id: str, text: str, metadata: dict) -> int:
        chunks = chunk_text(text, chunk_size=800, overlap=150)
        if not chunks:
            chunks = [text[:800]] if text else [metadata.get("snippet", "empty")]

        embeddings = await self.nim.generate_embeddings_batch(chunks)
        indexed = 0

        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            if not embedding:
                continue
            try:
                self.db.table("email_embeddings").insert({
                    "email_id": email_id,
                    "user_id": user_id,
                    "chunk_index": i,
                    "chunk_text": chunk,
                    "embedding": embedding,
                }).execute()
                indexed += 1
            except Exception as e:
                logger.error(f"Failed to index chunk {i} for email {email_id}: {e}")

        return indexed

    async def search(self, query: str, user_id: str, top_k: int = 15, threshold: float = 0.5) -> list[dict]:
        query_embedding = await self.nim.generate_embedding(query)
        if not query_embedding:
            return await self._fallback_keyword_search(query, user_id, top_k)

        try:
            result = self.db.rpc("match_emails", {
                "query_embedding": query_embedding,
                "match_user_id": user_id,
                "match_count": top_k,
                "match_threshold": threshold,
            }).execute()

            if not result.data:
                return await self._fallback_keyword_search(query, user_id, top_k)

            email_ids = list({r["email_id"] for r in result.data})
            emails_result = self.db.table("emails").select("*").in_("id", email_ids).execute()
            email_map = {e["id"]: e for e in (emails_result.data or [])}

            enriched = []
            for match in result.data:
                email = email_map.get(match["email_id"], {})
                enriched.append({
                    **email,
                    "email_id": match["email_id"],
                    "chunk_text": match["chunk_text"],
                    "similarity": match["similarity"],
                })

            enriched.sort(key=lambda x: x.get("similarity", 0), reverse=True)
            return enriched

        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return await self._fallback_keyword_search(query, user_id, top_k)

    async def _fallback_keyword_search(self, query: str, user_id: str, top_k: int) -> list[dict]:
        """Keyword-based fallback when vector search is unavailable."""
        keywords = query.lower().split()
        try:
            result = self.db.table("emails").select("*").eq("user_id", user_id).order(
                "received_at", desc=True
            ).limit(200).execute()

            scored = []
            for email in (result.data or []):
                text = f"{email.get('subject', '')} {email.get('body_text', '')} {email.get('snippet', '')}".lower()
                score = sum(1 for kw in keywords if kw in text)
                if score > 0:
                    scored.append({**email, "email_id": email["id"], "similarity": score / len(keywords)})

            scored.sort(key=lambda x: x["similarity"], reverse=True)
            return scored[:top_k]
        except Exception as e:
            logger.error(f"Fallback search error: {e}")
            return []

    async def search_by_sender(self, sender: str, user_id: str, days: Optional[int] = None) -> list[dict]:
        try:
            query = self.db.table("emails").select("*").eq("user_id", user_id).ilike(
                "sender_email", f"%{sender}%"
            )
            if days:
                from datetime import datetime, timedelta, timezone
                cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
                query = query.gte("received_at", cutoff)

            result = query.order("received_at", desc=True).limit(50).execute()
            return [{**e, "email_id": e["id"]} for e in (result.data or [])]
        except Exception as e:
            logger.error(f"Sender search error: {e}")
            return []

    async def search_by_category(self, category: str, user_id: str, limit: int = 50) -> list[dict]:
        try:
            cat_result = self.db.table("email_categories").select("email_id").eq(
                "category", category
            ).limit(limit).execute()

            if not cat_result.data:
                return []

            email_ids = [c["email_id"] for c in cat_result.data]
            emails_result = self.db.table("emails").select("*").eq(
                "user_id", user_id
            ).in_("id", email_ids).execute()

            return [{**e, "email_id": e["id"]} for e in (emails_result.data or [])]
        except Exception as e:
            logger.error(f"Category search error: {e}")
            return []
