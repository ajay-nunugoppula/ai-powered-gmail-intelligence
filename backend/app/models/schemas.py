from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from enum import Enum


class EmailCategory(str, Enum):
    newsletters = "newsletters"
    job_recruitment = "job_recruitment"
    finance = "finance"
    notifications = "notifications"
    personal = "personal"
    work_professional = "work_professional"
    uncategorized = "uncategorized"


# Auth
class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Emails
class EmailResponse(BaseModel):
    id: str
    gmail_message_id: str
    thread_id: str
    subject: Optional[str] = None
    sender: Optional[str] = None
    sender_email: Optional[str] = None
    snippet: Optional[str] = None
    summary: Optional[str] = None
    labels: list[str] = []
    is_read: bool = False
    received_at: Optional[datetime] = None
    category: Optional[EmailCategory] = None


class ThreadResponse(BaseModel):
    id: str
    gmail_thread_id: str
    subject: Optional[str] = None
    snippet: Optional[str] = None
    message_count: int = 0
    thread_summary: Optional[str] = None
    last_message_at: Optional[datetime] = None
    emails: list[EmailResponse] = []


class EmailListResponse(BaseModel):
    emails: list[EmailResponse]
    total: int
    page: int
    page_size: int


class ThreadListResponse(BaseModel):
    threads: list[ThreadResponse]
    total: int
    page: int
    page_size: int


# Compose
class ComposeRequest(BaseModel):
    prompt: str
    to: Optional[str] = None
    subject: Optional[str] = None


class ReplyRequest(BaseModel):
    thread_id: str
    prompt: str


class DraftResponse(BaseModel):
    subject: str
    body: str
    to: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: Optional[str] = None


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    thread_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: Optional[str] = None


# Chat
class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class SourceReference(BaseModel):
    email_id: str
    subject: Optional[str] = None
    sender: Optional[str] = None
    snippet: Optional[str] = None
    received_at: Optional[datetime] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: list[SourceReference] = []
    created_at: datetime


class ChatSessionResponse(BaseModel):
    id: str
    title: Optional[str] = None
    messages: list[ChatMessageResponse] = []
    created_at: datetime


# Sync
class SyncStatusResponse(BaseModel):
    status: str
    last_sync_at: Optional[datetime] = None
    total_emails_synced: int = 0
    message: Optional[str] = None


# Categories
class CategoryStats(BaseModel):
    category: EmailCategory
    count: int


class CategoryStatsResponse(BaseModel):
    categories: list[CategoryStats]
    total: int
