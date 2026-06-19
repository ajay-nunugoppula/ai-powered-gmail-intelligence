from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user_id
from app.models.schemas import (
    ChatCreateSessionRequest,
    ChatCreateSessionResponse,
    ChatSendMessageRequest,
    ChatSendMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionItem,
    ChatSessionListResponse,
    MessageResponse,
)
from app.services.chat import service as chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=ChatSessionListResponse)
def list_chat_sessions(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatSessionListResponse:
    items = [ChatSessionItem(**row) for row in chat_service.list_sessions(user_id)]
    return ChatSessionListResponse(items=items)


@router.post("/sessions", response_model=ChatCreateSessionResponse)
def create_chat_session(
    payload: ChatCreateSessionRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatCreateSessionResponse:
    session = chat_service.create_session(user_id, title=payload.title)
    return ChatCreateSessionResponse(session=ChatSessionItem(**session))


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
def get_chat_session(
    session_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatSessionDetailResponse:
    detail = chat_service.get_session_detail(user_id, session_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return ChatSessionDetailResponse(**detail)


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def delete_chat_session(
    session_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> MessageResponse:
    deleted = chat_service.delete_session(user_id, session_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return MessageResponse(message="Session deleted")


@router.post("/sessions/{session_id}/messages", response_model=ChatSendMessageResponse)
def send_chat_message(
    session_id: str,
    payload: ChatSendMessageRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatSendMessageResponse:
    try:
        result = chat_service.send_message(user_id, session_id, payload.content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return ChatSendMessageResponse(**result)
