from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.deps import get_current_user_id
from app.models.schemas import (
    ComposeDraftResponse,
    ComposeGenerateRequest,
    ComposeSendRequest,
    ComposeSendResponse,
)
from app.services.compose.service import generate_draft, send_email

router = APIRouter(prefix="/compose", tags=["compose"])


@router.post("/generate", response_model=ComposeDraftResponse)
def generate_compose_draft(
    payload: ComposeGenerateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ComposeDraftResponse:
    try:
        draft = generate_draft(
            user_id,
            mode=payload.mode,
            thread_id=payload.thread_id,
            message_id=payload.message_id,
            to=payload.to,
            cc=payload.cc,
            subject=payload.subject,
            tone=payload.tone,
            instructions=payload.instructions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        from app.services.compose.service import _format_ai_error

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_format_ai_error(exc),
        ) from exc

    return ComposeDraftResponse(**draft)


@router.post("/send", response_model=ComposeSendResponse)
def send_compose_email(
    payload: ComposeSendRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ComposeSendResponse:
    try:
        result = send_email(
            user_id,
            to=payload.to,
            cc=payload.cc or None,
            subject=payload.subject,
            body=payload.body,
            thread_id=payload.thread_id,
            reply_to_message_id=payload.reply_to_message_id,
            settings=settings,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if settings.enrichment_auto_start:
        from app.services.ai.enrichment import run_enrichment

        background_tasks.add_task(run_enrichment, user_id)

    return ComposeSendResponse(**result)
