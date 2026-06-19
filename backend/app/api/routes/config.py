from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models.schemas import AppConfigResponse

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=AppConfigResponse)
def get_app_config(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AppConfigResponse:
    return AppConfigResponse(
        sync_days_back=settings.sync_days_back,
        enrichment_auto_start=settings.enrichment_auto_start,
    )
