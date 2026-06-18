from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.deps import get_current_user_id
from app.models.schemas import SyncProgress, SyncStartResponse, SyncStatusResponse
from app.services import supabase_client
from app.services.sync.queue import enqueue_gmail_sync, run_gmail_sync_in_thread
from app.services.sync.recovery import reconcile_stale_sync_state

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_status(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> SyncStatusResponse:
    reconcile_stale_sync_state(user_id)
    state = supabase_client.get_sync_state(user_id)
    if not state:
        return SyncStatusResponse()

    progress_data = state.get("progress_json") or {}
    try:
        progress = SyncProgress.model_validate(progress_data)
    except Exception:
        progress = SyncProgress()

    return SyncStatusResponse(
        status=state.get("status", "idle"),
        history_id=state.get("history_id"),
        last_sync_at=state.get("last_sync_at"),
        progress=progress,
    )


@router.post("/start", response_model=SyncStartResponse)
async def start_sync(
    user_id: Annotated[str, Depends(get_current_user_id)],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SyncStartResponse:
    profile = supabase_client.get_profile(user_id)
    if not profile or not profile.get("gmail_connected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect Gmail before syncing",
        )

    reconcile_stale_sync_state(user_id)
    state = supabase_client.get_sync_state(user_id) or {}
    if state.get("status") == "syncing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sync already in progress",
        )

    job_type = (
        "incremental_sync"
        if state.get("history_id")
        else "initial_sync"
    )

    if settings.use_arq_worker:
        enqueued = await enqueue_gmail_sync(user_id, job_type)
        if not enqueued:
            background_tasks.add_task(run_gmail_sync_in_thread, user_id, job_type)
    else:
        background_tasks.add_task(run_gmail_sync_in_thread, user_id, job_type)

    return SyncStartResponse(
        job_type=job_type,
        status="started",
        message="Sync started in background",
    )
