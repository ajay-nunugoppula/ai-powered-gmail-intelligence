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


class EnrichmentProgress(BaseModel):
    status: str = "idle"
    phase: str = "idle"
    total: int = 0
    processed: int = 0
    error: str | None = None


class EnrichmentStatusResponse(BaseModel):
    status: str = "idle"
    phase: str = "idle"
    total: int = 0
    processed: int = 0
    error: str | None = None


class EnrichmentStartResponse(BaseModel):
    status: str
    pending_messages: int
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
    gmail_message_id: str | None = None
    from_email: str
    to_emails: list[str] = Field(default_factory=list)
    cc_emails: list[str] = Field(default_factory=list)
    subject: str | None = None
    body_text: str | None = None
    body_html: str | None = None
    received_at: str
    is_read: bool = False
    summary: str | None = None
    category: CategoryInfo | None = None
    category_confidence: float | None = None


class ThreadDetailResponse(BaseModel):
    thread: ThreadItem
    messages: list[MessageItem]


class ComposeGenerateRequest(BaseModel):
    mode: str = Field(pattern="^(reply|compose)$")
    thread_id: str | None = None
    message_id: str | None = None
    to: list[str] = Field(default_factory=list)
    cc: list[str] = Field(default_factory=list)
    subject: str | None = None
    tone: str = "professional"
    instructions: str | None = None


class ComposeDraftResponse(BaseModel):
    mode: str
    thread_id: str | None = None
    message_id: str | None = None
    subject: str
    body: str
    to: list[str] = Field(default_factory=list)
    cc: list[str] = Field(default_factory=list)


class ComposeSendRequest(BaseModel):
    to: list[str]
    cc: list[str] = Field(default_factory=list)
    subject: str
    body: str
    thread_id: str | None = None
    reply_to_message_id: str | None = None


class ComposeSendResponse(BaseModel):
    gmail_message_id: str | None = None
    gmail_thread_id: str | None = None
    message: str
