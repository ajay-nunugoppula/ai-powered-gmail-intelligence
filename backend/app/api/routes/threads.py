from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_current_user_id
from app.models.schemas import (
    CategoryInfo,
    MessageItem,
    ThreadDetailResponse,
    ThreadItem,
    ThreadListResponse,
)
from app.services import supabase_client

router = APIRouter(prefix="/threads", tags=["threads"])


def _map_thread(row: dict) -> ThreadItem:
    row_copy = dict(row)
    category_data = row_copy.pop("categories", None)
    category = CategoryInfo(**category_data) if category_data else None
    return ThreadItem(
        id=row_copy["id"],
        gmail_thread_id=row_copy["gmail_thread_id"],
        subject=row_copy.get("subject"),
        snippet=row_copy.get("snippet"),
        last_message_at=row_copy.get("last_message_at"),
        participant_emails=row_copy.get("participant_emails") or [],
        message_count=row_copy.get("message_count") or 0,
        thread_summary=row_copy.get("thread_summary"),
        category=category,
    )


@router.get("", response_model=ThreadListResponse)
def list_threads(
    user_id: Annotated[str, Depends(get_current_user_id)],
    category: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ThreadListResponse:
    rows, total = supabase_client.list_threads(
        user_id,
        category_slug=category,
        search=search,
        page=page,
        limit=limit,
    )
    items = [_map_thread(dict(row)) for row in rows]
    return ThreadListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/{thread_id}", response_model=ThreadDetailResponse)
def get_thread(
    thread_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ThreadDetailResponse:
    detail = supabase_client.get_thread_detail_with_enrichment(user_id, thread_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )

    thread = _map_thread(dict(detail["thread"]))
    messages = [
        MessageItem(
            id=message["id"],
            gmail_message_id=message.get("gmail_message_id"),
            from_email=message["from_email"],
            to_emails=message.get("to_emails") or [],
            cc_emails=message.get("cc_emails") or [],
            subject=message.get("subject"),
            body_text=message.get("body_text"),
            body_html=message.get("body_html"),
            received_at=message["received_at"],
            is_read=message.get("is_read", False),
            summary=message.get("summary"),
            category=(
                CategoryInfo(**message["category"])
                if message.get("category")
                else None
            ),
            category_confidence=message.get("category_confidence"),
        )
        for message in detail["messages"]
    ]
    return ThreadDetailResponse(thread=thread, messages=messages)
