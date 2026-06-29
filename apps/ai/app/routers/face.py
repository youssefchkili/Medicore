import logging
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from app.cv.face_auth import extract_embedding, verify_face
from app.db.client import (
    fetch_face_embedding,
    insert_biometric_log,
    upsert_face_embedding,
)
from app.dependencies import verify_internal_secret

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/face", tags=["face"])


class EnrollResponse(BaseModel):
    enrolled: bool
    photos_used: int


class VerifyResponse(BaseModel):
    success: bool
    similarity_score: float
    anti_spoof_pass: bool


@router.post(
    "/enroll",
    response_model=EnrollResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def enroll_face(
    doctor_id: str = Form(...),
    photos: list[UploadFile] = File(..., description="1-5 enrollment photos (JPEG/PNG)"),
):
    """
    Enroll a doctor's face by uploading 1-5 photos.
    The ArcFace embeddings are averaged for a more robust enrollment vector.
    Raw photos are NOT stored — only the 512-float embedding is saved to Supabase.
    """
    if not photos:
        raise HTTPException(status_code=400, detail="At least one photo is required")
    if len(photos) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 enrollment photos allowed")

    embeddings: list[list[float]] = []
    anti_spoof_scores: list[float] = []

    for photo in photos:
        image_bytes = await photo.read()
        try:
            emb, score = extract_embedding(image_bytes)
            embeddings.append(emb)
            anti_spoof_scores.append(score)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Face detection failed: {exc}")

    # Average embeddings across all photos → more stable enrollment vector
    avg_embedding: list[float] = np.mean(embeddings, axis=0).tolist()
    avg_anti_spoof = float(np.mean(anti_spoof_scores))

    await upsert_face_embedding(
        doctor_id=doctor_id,
        embedding=avg_embedding,
        anti_spoof_score=avg_anti_spoof,
    )

    logger.info("Enrolled face for doctor %s using %d photo(s)", doctor_id, len(embeddings))
    return EnrollResponse(enrolled=True, photos_used=len(embeddings))


@router.post(
    "/verify",
    response_model=VerifyResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def verify_face_endpoint(
    request: Request,
    doctor_id: str = Form(...),
    photo: UploadFile = File(..., description="Live capture photo for biometric login"),
):
    """
    Verify a doctor's identity via face recognition.
    Logs the attempt to biometric_login_logs regardless of result.
    Returns success=True only when both the similarity threshold is met
    AND the anti-spoofing check passes.
    """
    stored = await fetch_face_embedding(doctor_id)
    if not stored:
        raise HTTPException(
            status_code=404, detail="No face enrollment found for this doctor"
        )

    image_bytes = await photo.read()
    try:
        probe_embedding, anti_spoof_score = extract_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Face detection failed: {exc}")

    anti_spoof_pass = anti_spoof_score >= 0.5
    is_match, similarity = verify_face(
        stored_embedding=stored["embedding"],
        probe_embedding=probe_embedding,
    )

    success = is_match and anti_spoof_pass

    ip_address: str | None = request.client.host if request.client else None
    user_agent: str | None = request.headers.get("user-agent")

    await insert_biometric_log(
        doctor_id=doctor_id,
        success=success,
        similarity_score=similarity,
        anti_spoof_pass=anti_spoof_pass,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    logger.info(
        "Face verify for doctor %s: success=%s similarity=%.3f anti_spoof=%s",
        doctor_id, success, similarity, anti_spoof_pass,
    )
    return VerifyResponse(
        success=success,
        similarity_score=similarity,
        anti_spoof_pass=anti_spoof_pass,
    )
