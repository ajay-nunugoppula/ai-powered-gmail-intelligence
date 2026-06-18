import logging
import json
from typing import Optional
import google.generativeai as genai
from app.config import get_settings

logger = logging.getLogger(__name__)


class AIService:
    """Primary AI service using Google Gemini."""

    def __init__(self):
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(settings.gemini_model)

    async def summarize_email(self, subject: str, sender: str, body: str) -> str:
        prompt = f"""Summarize this email concisely in 2-3 sentences. Focus on key information, action items, and decisions.

From: {sender}
Subject: {subject}

{body[:4000]}

Summary:"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Email summarization error: {e}")
            return f"Email from {sender} about: {subject}"

    async def summarize_thread(self, subject: str, messages: list[dict]) -> str:
        conversation = "\n\n---\n\n".join(
            f"From: {m.get('sender', 'Unknown')} ({m.get('received_at', '')})\n{m.get('body_text', m.get('snippet', ''))[:1500]}"
            for m in messages
        )

        prompt = f"""Summarize this email thread. Capture the full conversation arc — what was discussed, decisions made, and current status.

Subject: {subject}
Number of messages: {len(messages)}

Conversation:
{conversation[:8000]}

Thread Summary:"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Thread summarization error: {e}")
            return f"Thread about: {subject} ({len(messages)} messages)"

    async def compose_email(self, prompt: str, context: Optional[str] = None) -> dict:
        system_context = ""
        if context:
            system_context = f"\n\nAdditional context:\n{context[:3000]}"

        full_prompt = f"""Draft a professional email based on this request. Return a JSON object with "subject" and "body" fields.

Request: {prompt}{system_context}

Return ONLY valid JSON: {{"subject": "...", "body": "..."}}"""

        try:
            response = self.model.generate_content(full_prompt)
            text = response.text.strip()
            if "{" in text:
                json_str = text[text.index("{"):text.rindex("}") + 1]
                return json.loads(json_str)
        except Exception as e:
            logger.error(f"Compose email error: {e}")

        return {"subject": "Draft Email", "body": prompt}

    async def draft_reply(self, thread_messages: list[dict], prompt: str) -> dict:
        conversation = "\n\n---\n\n".join(
            f"From: {m.get('sender', 'Unknown')}\nSubject: {m.get('subject', '')}\n{m.get('body_text', m.get('snippet', ''))[:2000]}"
            for m in thread_messages
        )

        last_msg = thread_messages[-1] if thread_messages else {}
        in_reply_to = last_msg.get("gmail_message_id", "")
        references = last_msg.get("references_header", "")
        if references:
            references = f"{references} {in_reply_to}"
        else:
            references = in_reply_to

        full_prompt = f"""Draft a reply to this email thread based on the user's instruction. 
Understand the full conversation context before drafting.

Thread conversation:
{conversation[:8000]}

User's instruction: {prompt}

Return ONLY valid JSON: {{"subject": "Re: ...", "body": "...", "to": "{last_msg.get('sender_email', '')}"}}"""

        try:
            response = self.model.generate_content(full_prompt)
            text = response.text.strip()
            if "{" in text:
                json_str = text[text.index("{"):text.rindex("}") + 1]
                result = json.loads(json_str)
                result["in_reply_to"] = in_reply_to
                result["references"] = references
                return result
        except Exception as e:
            logger.error(f"Draft reply error: {e}")

        return {
            "subject": f"Re: {last_msg.get('subject', '')}",
            "body": prompt,
            "to": last_msg.get("sender_email", ""),
            "in_reply_to": in_reply_to,
            "references": references,
        }

    async def chat_with_context(self, query: str, email_context: list[dict], chat_history: list[dict]) -> dict:
        context_block = ""
        sources = []

        for i, ctx in enumerate(email_context):
            context_block += f"""
[Email {i + 1}]
ID: {ctx.get('email_id', ctx.get('id', ''))}
From: {ctx.get('sender', 'Unknown')} ({ctx.get('sender_email', '')})
Subject: {ctx.get('subject', '')}
Date: {ctx.get('received_at', '')}
Content: {ctx.get('chunk_text', ctx.get('body_text', ctx.get('snippet', '')))[:2000]}
---
"""
            sources.append({
                "email_id": ctx.get("email_id", ctx.get("id", "")),
                "subject": ctx.get("subject"),
                "sender": ctx.get("sender"),
                "snippet": ctx.get("snippet", ctx.get("chunk_text", ""))[:200],
                "received_at": ctx.get("received_at"),
            })

        history_block = ""
        for msg in chat_history[-6:]:
            history_block += f"{msg['role'].upper()}: {msg['content']}\n"

        prompt = f"""You are an email intelligence assistant. Answer questions using ONLY the email data provided below.
If the information is not in the emails, say "I don't have that information in your emails."
Always cite which email(s) your answer comes from using [Email N] references.
Never hallucinate or invent information not present in the emails.

EMAIL KNOWLEDGE BASE:
{context_block if context_block else "No relevant emails found."}

CONVERSATION HISTORY:
{history_block}

USER QUESTION: {query}

Provide a helpful, accurate answer with source citations:"""

        try:
            response = self.model.generate_content(prompt)
            return {
                "content": response.text.strip(),
                "sources": sources[:10],
            }
        except Exception as e:
            logger.error(f"Chat error: {e}")
            return {
                "content": "I encountered an error processing your request. Please try again.",
                "sources": [],
            }

    async def extract_news_items(self, subject: str, body: str, source_name: str) -> list[dict]:
        prompt = f"""Extract individual news items from this newsletter email.
Return a JSON array of objects with "title", "summary" (1 sentence), and "url" (if found) fields.
Only include actual news items, not ads or navigation links.

Newsletter: {source_name}
Subject: {subject}
Content:
{body[:6000]}

Return ONLY a JSON array:"""

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            if "[" in text:
                json_str = text[text.index("["):text.rindex("]") + 1]
                items = json.loads(json_str)
                for item in items:
                    item["source_name"] = source_name
                return items
        except Exception as e:
            logger.error(f"News extraction error: {e}")
        return []
