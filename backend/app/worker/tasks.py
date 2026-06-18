import asyncio

from app.services.sync.service import run_gmail_sync


async def run_gmail_sync_task(_ctx: dict, user_id: str, job_type: str = "initial_sync") -> dict:
    await asyncio.to_thread(run_gmail_sync, user_id, job_type)
    return {"status": "completed", "user_id": user_id, "job_type": job_type}
