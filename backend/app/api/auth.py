import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

from app.config import get_settings
from app.dependencies import create_access_token, get_current_user
from app.models.database import get_supabase
from app.models.schemas import TokenResponse, UserResponse
from app.services.gmail_service import GMAIL_SCOPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _get_oauth_flow() -> Flow:
    settings = get_settings()
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=GMAIL_SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


@router.get("/login")
async def login():
    flow = _get_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"authorization_url": authorization_url, "state": state}


@router.get("/callback")
async def callback(code: str = Query(...), state: str = Query(None)):
    settings = get_settings()
    flow = _get_oauth_flow()

    try:
        flow.fetch_token(code=code)
    except Exception as e:
        logger.error(f"OAuth token exchange failed: {e}")
        return RedirectResponse(f"{settings.frontend_url}/login?error=auth_failed")

    credentials = flow.credentials
    db = get_supabase()

    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
        userinfo = userinfo_resp.json()

    google_id = userinfo["id"]
    email = userinfo["email"]
    name = userinfo.get("name", "")
    avatar = userinfo.get("picture", "")

    existing = db.table("users").select("*").eq("google_id", google_id).execute()
    if existing.data:
        user = existing.data[0]
        db.table("users").update({
            "name": name,
            "avatar_url": avatar,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", user["id"]).execute()
        user_id = user["id"]
    else:
        result = db.table("users").insert({
            "google_id": google_id,
            "email": email,
            "name": name,
            "avatar_url": avatar,
        }).execute()
        user_id = result.data[0]["id"]

    expiry = None
    if credentials.expiry:
        expiry = credentials.expiry.isoformat()

    db.table("oauth_tokens").upsert({
        "user_id": user_id,
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": expiry,
        "scopes": list(credentials.scopes or GMAIL_SCOPES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()

    db.table("sync_state").upsert({
        "user_id": user_id,
        "sync_status": "idle",
    }, on_conflict="user_id").execute()

    jwt_token = create_access_token(user_id, email)
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={jwt_token}")


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        avatar_url=user.get("avatar_url"),
    )
