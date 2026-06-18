import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks

from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import (
    EmailResponse, EmailListResponse, ThreadResponse, ThreadListResponse,
    SyncStatusResponse, EmailCategory,
)
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("", response_model=EmailListResponse)
async def list_emails(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[EmailCategory] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    db = get_supabase()
    offset = (page - 1) * page_size

    if category:
        cat_result = db.table("email_categories").select("email_id").eq("category", category.value).execute()
        email_ids = [c["email_id"] for c in (cat_result.data or [])]
        if not email_ids:
            return EmailListResponse(emails=[], total=0, page=page, page_size=page_size)

        query = db.table("emails").select("*", count="exact").eq("user_id", user["id"]).in_("id", email_ids)
    else:
        query = db.table("emails").select("*", count="exact").eq("user_id", user["id"])

    if search:
        query = query.or_(f"subject.ilike.%{search}%,sender.ilike.%{search}%,snippet.ilike.%{search}%")

    result = query.order("received_at", desc=True).range(offset, offset + page_size - 1).execute()
    total = result.count or 0

    email_ids = [e["id"] for e in (result.data or [])]
    categories = {}
    if email_ids:
        cat_data = db.table("email_categories").select("*").in_("email_id", email_ids).execute()
        categories = {c["email_id"]: c["category"] for c in (cat_data.data or [])}

    emails = [
        EmailResponse(
            id=e["id"],
            gmail_message_id=e["gmail_message_id"],
            thread_id=e["thread_id"],
            subject=e.get("subject"),
            sender=e.get("sender"),
            sender_email=e.get("sender_email"),
            snippet=e.get("snippet"),
            summary=e.get("summary"),
            labels=e.get("labels", []),
            is_read=e.get("is_read", False),
            received_at=e.get("received_at"),
            category=categories.get(e["id"]),
        )
        for e in (result.data or [])
    ]

    return EmailListResponse(emails=emails, total=total, page=page, page_size=page_size)


@router.get("/threads", response_model=ThreadListResponse)
async def list_threads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    db = get_supabase()
    offset = (page - 1) * page_size

    result = db.table("threads").select("*", count="exact").eq(
        "user_id", user["id"]
    ).order("last_message_at", desc=True).range(offset, offset + page_size - 1).execute()

    threads = [
        ThreadResponse(
            id=t["id"],
            gmail_thread_id=t["gmail_thread_id"],
            subject=t.get("subject"),
            snippet=t.get("snippet"),
            message_count=t.get("message_count", 0),
            thread_summary=t.get("thread_summary"),
            last_message_at=t.get("last_message_at"),
        )
        for t in (result.data or [])
    ]

    return ThreadListResponse(threads=threads, total=result.count or 0, page=page, page_size=page_size)


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(thread_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()

    thread = db.table("threads").select("*").eq("id", thread_id).eq("user_id", user["id"]).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    emails_result = db.table("emails").select("*").eq("thread_id", thread_id).order("received_at").execute()

    email_ids = [e["id"] for e in (emails_result.data or [])]
    categories = {}
    if email_ids:
        cat_data = db.table("email_categories").select("*").in_("email_id", email_ids).execute()
        categories = {c["email_id"]: c["category"] for c in (cat_data.data or [])}

    t = thread.data
    return ThreadResponse(
        id=t["id"],
        gmail_thread_id=t["gmail_thread_id"],
        subject=t.get("subject"),
        snippet=t.get("snippet"),
        message_count=t.get("message_count", 0),
        thread_summary=t.get("thread_summary"),
        last_message_at=t.get("last_message_at"),
        emails=[
            EmailResponse(
                id=e["id"],
                gmail_message_id=e["gmail_message_id"],
                thread_id=e["thread_id"],
                subject=e.get("subject"),
                sender=e.get("sender"),
                sender_email=e.get("sender_email"),
                snippet=e.get("snippet"),
                summary=e.get("summary"),
                labels=e.get("labels", []),
                is_read=e.get("is_read", False),
                received_at=e.get("received_at"),
                category=categories.get(e["id"]),
            )
            for e in (emails_result.data or [])
        ],
    )


@router.post("/sync", response_model=SyncStatusResponse)
async def trigger_sync(
    background_tasks: BackgroundTasks,
    full: bool = False,
    user: dict = Depends(get_current_user),
):
    sync_service = SyncService()

    async def run_sync():
        await sync_service.sync_user_emails(user["id"], full_sync=full)
        await sync_service.summarize_threads(user["id"])

    background_tasks.add_task(run_sync)

    return SyncStatusResponse(status="syncing", message="Email sync started in background")


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("sync_state").select("*").eq("user_id", user["id"]).execute()
    if not result.data:
        return SyncStatusResponse(status="idle", total_emails_synced=0)

    state = result.data[0]
    return SyncStatusResponse(
        status=state.get("sync_status", "idle"),
        last_sync_at=state.get("last_sync_at"),
        total_emails_synced=state.get("total_emails_synced", 0),
    )


@router.get("/{email_id}", response_model=EmailResponse)
async def get_email(email_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("emails").select("*").eq("id", email_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Email not found")

    e = result.data
    cat = db.table("email_categories").select("category").eq("email_id", email_id).execute()

    return EmailResponse(
        id=e["id"],
        gmail_message_id=e["gmail_message_id"],
        thread_id=e["thread_id"],
        subject=e.get("subject"),
        sender=e.get("sender"),
        sender_email=e.get("sender_email"),
        snippet=e.get("snippet"),
        summary=e.get("summary"),
        labels=e.get("labels", []),
        is_read=e.get("is_read", False),
        received_at=e.get("received_at"),
        category=cat.data[0]["category"] if cat.data else None,
    )
