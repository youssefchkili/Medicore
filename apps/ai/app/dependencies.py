from fastapi import Header, HTTPException, status
from .config import get_settings


async def verify_internal_secret(x_internal_secret: str = Header(...)) -> None:
    if x_internal_secret != get_settings().ai_service_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
