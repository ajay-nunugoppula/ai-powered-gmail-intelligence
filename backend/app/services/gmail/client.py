from google.oauth2.credentials import Credentials
from googleapiclient.discovery import Resource, build

from app.config import Settings, get_settings
from app.services.crypto import decrypt_token
from app.services.gmail.oauth import GMAIL_SCOPES
from app.services import supabase_client


def build_gmail_service(user_id: str, settings: Settings | None = None) -> Resource:
    settings = settings or get_settings()
    credentials_row = supabase_client.get_gmail_credentials(user_id)
    if not credentials_row:
        raise ValueError("Gmail is not connected for this user")

    refresh_token = decrypt_token(credentials_row["refresh_token_enc"], settings)
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=GMAIL_SCOPES,
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)
