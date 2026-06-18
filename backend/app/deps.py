import logging
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

from app.config import Settings, get_settings
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(supabase_url: str) -> PyJWKClient:
    base_url = supabase_url.rstrip("/")
    if base_url not in _jwks_clients:
        _jwks_clients[base_url] = PyJWKClient(
            f"{base_url}/auth/v1/.well-known/jwks.json"
        )
    return _jwks_clients[base_url]


def _decode_supabase_jwt(token: str, settings: Settings) -> dict:
    """Validate Supabase access tokens (HS256 legacy or ES256/RS256 JWKS)."""
    if not settings.supabase_url:
        raise InvalidTokenError("Supabase URL is not configured")

    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg", "HS256")

    if algorithm == "HS256":
        if not settings.supabase_jwt_secret:
            raise InvalidTokenError("SUPABASE_JWT_SECRET is not configured")
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )

    jwks_client = _get_jwks_client(settings.supabase_url)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[algorithm],
        audience="authenticated",
    )


def _validate_via_supabase_api(token: str) -> str:
    client = get_supabase_client()
    user_response = client.auth.get_user(jwt=token)
    if not user_response or not user_response.user:
        raise InvalidTokenError("Supabase rejected the access token")
    return user_response.user.id


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    try:
        payload = _decode_supabase_jwt(token, settings)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return user_id
    except InvalidTokenError as local_error:
        logger.debug("Local JWT validation failed: %s", local_error)

    try:
        return _validate_via_supabase_api(token)
    except Exception as exc:
        logger.warning("Token validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc
