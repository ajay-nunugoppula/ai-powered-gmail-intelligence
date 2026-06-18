from pydantic import BaseModel, Field


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


class SyncProgress(BaseModel):
    phase: str = "idle"
    total: int = 0
    processed: int = 0
    threads_synced: int = 0
    messages_synced: int = 0
    error: str | None = None


class SyncStatusResponse(BaseModel):
    status: str = "idle"
    history_id: str | None = None
    last_sync_at: str | None = None
    progress: SyncProgress = Field(default_factory=SyncProgress)


class SyncStartResponse(BaseModel):
    job_type: str
    status: str
    message: str


class CategoryInfo(BaseModel):
    name: str | None = None
    slug: str | None = None
    color: str | None = None


class ThreadItem(BaseModel):
    id: str
    gmail_thread_id: str
    subject: str | None = None
    snippet: str | None = None
    last_message_at: str | None = None
    participant_emails: list[str] = Field(default_factory=list)
    message_count: int = 0
    thread_summary: str | None = None
    category: CategoryInfo | None = None


class ThreadListResponse(BaseModel):
    items: list[ThreadItem]
    total: int
    page: int
    limit: int


class MessageItem(BaseModel):
    id: str
    from_email: str
    to_emails: list[str] = Field(default_factory=list)
    cc_emails: list[str] = Field(default_factory=list)
    subject: str | None = None
    body_text: str | None = None
    body_html: str | None = None
    received_at: str
    is_read: bool = False


class ThreadDetailResponse(BaseModel):
    thread: ThreadItem
    messages: list[MessageItem]
