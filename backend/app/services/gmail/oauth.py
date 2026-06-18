import hashlib
import os
import secrets
from base64 import urlsafe_b64encode
from datetime import UTC, datetime, timedelta

from google_auth_oauthlib.flow import Flow
from jose import JWTError
from jose import jwt as jose_jwt

from app.config import Settings

# Google may append openid/profile/email scopes — store superset for credentials record
GMAIL_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

# Google often returns a broader scope set than requested; oauthlib raises without this.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


def _client_config(settings: Settings) -> dict:
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def _create_flow(settings: Settings) -> Flow:
    return Flow.from_client_config(
        _client_config(settings),
        scopes=GMAIL_SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


def _generate_pkce_pair() -> tuple[str, str]:
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return code_verifier, code_challenge


def create_oauth_state(
    user_id: str,
    settings: Settings,
    code_verifier: str,
) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=10)
    return jose_jwt.encode(
        {
            "sub": user_id,
            "purpose": "gmail_connect",
            "cv": code_verifier,
            "exp": expires,
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )


def verify_oauth_state(state: str, settings: Settings) -> tuple[str, str]:
    try:
        payload = jose_jwt.decode(
            state,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
        )
    except JWTError as exc:
        raise ValueError("Invalid OAuth state") from exc

    if payload.get("purpose") != "gmail_connect":
        raise ValueError("Invalid OAuth state purpose")

    user_id = payload.get("sub")
    code_verifier = payload.get("cv")
    if not user_id or not code_verifier:
        raise ValueError("Missing OAuth state data")

    return user_id, code_verifier


def get_authorization_url(user_id: str, settings: Settings) -> str:
    flow = _create_flow(settings)
    code_verifier, code_challenge = _generate_pkce_pair()
    state = create_oauth_state(user_id, settings, code_verifier)
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    return authorization_url


def exchange_code_for_refresh_token(
    code: str,
    settings: Settings,
    code_verifier: str,
) -> str:
    flow = _create_flow(settings)
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials = flow.credentials

    if not credentials.refresh_token:
        raise ValueError(
            "No refresh token received. Revoke app access in Google Account "
            "settings and reconnect with consent."
        )

    return credentials.refresh_token
