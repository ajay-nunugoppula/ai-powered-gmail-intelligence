from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.deps import get_current_user_id
from app.models.schemas import GmailConnectResponse, MessageResponse, UserProfile
from app.services import supabase_client
from app.services.crypto import TokenEncryptionError, encrypt_token
from app.services.gmail.oauth import (
    GMAIL_SCOPES,
    exchange_code_for_refresh_token,
    get_authorization_url,
    verify_oauth_state,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserProfile)
def get_me(user_id: Annotated[str, Depends(get_current_user_id)]) -> UserProfile:
    profile = supabase_client.get_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    return UserProfile(**profile)


@router.post("/gmail/connect", response_model=GmailConnectResponse)
def connect_gmail(
    user_id: Annotated[str, Depends(get_current_user_id)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GmailConnectResponse:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    auth_url = get_authorization_url(user_id, settings)
    return GmailConnectResponse(auth_url=auth_url)


@router.get("/gmail/callback")
def gmail_callback(
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RedirectResponse:
    success_url = f"{settings.frontend_url}/dashboard?gmail=connected"
    error_url = f"{settings.frontend_url}/dashboard?gmail=error"

    try:
        user_id = verify_oauth_state(state, settings)
        refresh_token = exchange_code_for_refresh_token(code, settings)
        encrypted = encrypt_token(refresh_token, settings)
        supabase_client.upsert_gmail_credentials(user_id, encrypted, GMAIL_SCOPES)
        supabase_client.set_gmail_connected(user_id, True)
        return RedirectResponse(url=success_url, status_code=status.HTTP_302_FOUND)
    except (ValueError, TokenEncryptionError):
        return RedirectResponse(url=error_url, status_code=status.HTTP_302_FOUND)


@router.delete("/gmail/disconnect", response_model=MessageResponse)
def disconnect_gmail(
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> MessageResponse:
    supabase_client.delete_gmail_credentials(user_id)
    supabase_client.set_gmail_connected(user_id, False)
    return MessageResponse(message="Gmail disconnected")
