from datetime import UTC, datetime, timedelta

from google_auth_oauthlib.flow import Flow
from jose import JWTError, jwt

from app.config import Settings

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


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


def create_oauth_state(user_id: str, settings: Settings) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=10)
    return jwt.encode(
        {
            "sub": user_id,
            "purpose": "gmail_connect",
            "exp": expires,
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )


def verify_oauth_state(state: str, settings: Settings) -> str:
    try:
        payload = jwt.decode(
            state,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
        )
    except JWTError as exc:
        raise ValueError("Invalid OAuth state") from exc

    if payload.get("purpose") != "gmail_connect":
        raise ValueError("Invalid OAuth state purpose")

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Missing user in OAuth state")

    return user_id


def get_authorization_url(user_id: str, settings: Settings) -> str:
    flow = _create_flow(settings)
    state = create_oauth_state(user_id, settings)
    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return authorization_url


def exchange_code_for_refresh_token(code: str, settings: Settings) -> str:
    flow = _create_flow(settings)
    flow.fetch_token(code=code)
    credentials = flow.credentials

    if not credentials.refresh_token:
        raise ValueError(
            "No refresh token received. Revoke app access in Google Account "
            "settings and reconnect with consent."
        )

    return credentials.refresh_token
