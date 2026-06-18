from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import CategoryStatsResponse, CategoryStats, EmailCategory

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/stats", response_model=CategoryStatsResponse)
async def get_category_stats(user: dict = Depends(get_current_user)):
    db = get_supabase()

    emails_result = db.table("emails").select("id", count="exact").eq("user_id", user["id"]).execute()
    total_emails = emails_result.count or 0

    email_ids = [e["id"] for e in (emails_result.data or [])]
    if not email_ids:
        return CategoryStatsResponse(categories=[], total=0)

    all_emails = db.table("emails").select("id").eq("user_id", user["id"]).execute()
    all_ids = [e["id"] for e in (all_emails.data or [])]

    cat_result = db.table("email_categories").select("category").in_("email_id", all_ids).execute()

    counts = {}
    for cat in (cat_result.data or []):
        c = cat["category"]
        counts[c] = counts.get(c, 0) + 1

    categories = [
        CategoryStats(category=EmailCategory(c), count=count)
        for c, count in sorted(counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return CategoryStatsResponse(categories=categories, total=total_emails)
