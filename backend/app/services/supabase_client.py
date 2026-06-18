from datetime import UTC, datetime

from supabase import Client, create_client

from app.config import get_settings


def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError("Supabase is not configured")
    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_profile(user_id: str) -> dict | None:
    client = get_supabase_client()
    result = (
        client.table("profiles")
        .select("id, email, display_name, avatar_url, gmail_connected, created_at")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data


def set_gmail_connected(user_id: str, connected: bool) -> None:
    client = get_supabase_client()
    client.table("profiles").update(
        {
            "gmail_connected": connected,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", user_id).execute()


def upsert_gmail_credentials(
    user_id: str,
    refresh_token_enc: str,
    scopes: list[str],
) -> None:
    client = get_supabase_client()
    client.table("gmail_credentials").upsert(
        {
            "user_id": user_id,
            "refresh_token_enc": refresh_token_enc,
            "scopes": scopes,
            "token_updated_at": datetime.now(UTC).isoformat(),
        }
    ).execute()


def delete_gmail_credentials(user_id: str) -> None:
    client = get_supabase_client()
    client.table("gmail_credentials").delete().eq("user_id", user_id).execute()
