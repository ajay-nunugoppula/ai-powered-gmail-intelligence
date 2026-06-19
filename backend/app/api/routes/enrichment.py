from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.deps import get_current_user_id
from app.models.schemas import EnrichmentStartResponse, EnrichmentStatusResponse
from app.services import supabase_client
from app.services.ai.enrichment import run_enrichment
from app.services.sync.recovery import reconcile_stale_sync_state

router = APIRouter(prefix="/enrichment", tags=["enrichment"])


def _is_enrichment_running(user_id: str) -> bool:
    progress = supabase_client.get_enrichment_progress(user_id)
    if progress.get("status") != "running":
        return False

    last_at = progress.get("last_progress_at")
    if not last_at:
        return False

    try:
        parsed = datetime.fromisoformat(str(last_at).replace("Z", "+00:00"))
    except ValueError:
        return False

    stale_seconds = get_settings().sync_stale_seconds
    return (datetime.now(UTC) - parsed).total_seconds() <= stale_seconds


@router.get("/status", response_model=EnrichmentStatusResponse)
def get_enrichment_status(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> EnrichmentStatusResponse:
    reconcile_stale_sync_state(user_id)
    progress = supabase_client.get_enrichment_progress(user_id)

    if progress.get("status") == "running" and not _is_enrichment_running(user_id):
        progress = {
            **progress,
            "status": "failed",
            "error": "AI enrichment was interrupted. Click Analyze to retry.",
            "phase": "interrupted",
        }
        supabase_client.update_enrichment_progress(user_id, progress)

    return EnrichmentStatusResponse(
        status=progress.get("status", "idle"),
        phase=progress.get("phase", "idle"),
        total=progress.get("total", 0),
        processed=progress.get("processed", 0),
        error=progress.get("error"),
    )


@router.post("/start", response_model=EnrichmentStartResponse)
def start_enrichment(
    user_id: Annotated[str, Depends(get_current_user_id)],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
) -> EnrichmentStartResponse:
    profile = supabase_client.get_profile(user_id)
    if not profile or not profile.get("gmail_connected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect Gmail before running AI enrichment",
        )

    if not settings.gemini_api_key and not settings.nvidia_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure GEMINI_API_KEY and/or NVIDIA_API_KEY in backend/.env",
        )

    sync_state = supabase_client.get_sync_state(user_id) or {}
    if sync_state.get("status") == "syncing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wait for Gmail sync to finish before running AI enrichment",
        )

    if _is_enrichment_running(user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="AI enrichment already in progress",
        )

    pending = supabase_client.count_messages_needing_enrichment(user_id)
    background_tasks.add_task(run_enrichment, user_id)

    return EnrichmentStartResponse(
        status="started",
        pending_messages=pending,
        message="AI enrichment started in background",
    )
