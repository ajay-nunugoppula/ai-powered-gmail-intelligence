import logging
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import ComposeRequest, ReplyRequest, DraftResponse, SendEmailRequest
from app.services.ai_service import AIService
from app.services.gmail_service import GmailService
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compose", tags=["compose"])


@router.post("/draft", response_model=DraftResponse)
async def compose_draft(request: ComposeRequest, user: dict = Depends(get_current_user)):
    ai = AIService()
    result = await ai.compose_email(request.prompt)

    return DraftResponse(
        subject=result.get("subject", "Draft"),
        body=result.get("body", ""),
        to=request.to,
    )


@router.post("/reply", response_model=DraftResponse)
async def draft_reply(request: ReplyRequest, user: dict = Depends(get_current_user)):
    db = get_supabase()
    ai = AIService()

    thread = db.table("threads").select("*").eq("id", request.thread_id).eq("user_id", user["id"]).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    emails = db.table("emails").select("*").eq("thread_id", request.thread_id).order("received_at").execute()
    if not emails.data:
        raise HTTPException(status_code=404, detail="No emails in thread")

    result = await ai.draft_reply(emails.data, request.prompt)

    return DraftResponse(
        subject=result.get("subject", f"Re: {thread.data.get('subject', '')}"),
        body=result.get("body", ""),
        to=result.get("to"),
        in_reply_to=result.get("in_reply_to"),
        references=result.get("references"),
    )


@router.post("/send")
async def send_email(request: SendEmailRequest, user: dict = Depends(get_current_user)):
    sync_service = SyncService()
    gmail = await sync_service.get_gmail_service(user["id"])
    if not gmail:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    gmail_thread_id = None
    if request.thread_id:
        db = get_supabase()
        thread = db.table("threads").select("gmail_thread_id").eq("id", request.thread_id).single().execute()
        if thread.data:
            gmail_thread_id = thread.data["gmail_thread_id"]

    try:
        result = await gmail.send_message(
            to=request.to,
            subject=request.subject,
            body=request.body,
            thread_id=gmail_thread_id,
            in_reply_to=request.in_reply_to,
            references=request.references,
        )
        return {"status": "sent", "message_id": result.get("id")}
    except Exception as e:
        logger.error(f"Send email error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
