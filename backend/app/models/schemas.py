from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class UserProfile(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    gmail_connected: bool = False


class GmailConnectResponse(BaseModel):
    auth_url: str


class MessageResponse(BaseModel):
    message: str
