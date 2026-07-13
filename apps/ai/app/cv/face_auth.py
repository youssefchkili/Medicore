import logging

import numpy as np
import cv2
from deepface import DeepFace
from ..config import get_settings

logger = logging.getLogger(__name__)


def _decode_image(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def extract_embedding(image_bytes: bytes) -> tuple[list[float], float]:
    """
    Extract an ArcFace embedding from raw image bytes.

    Returns:
        (embedding, anti_spoof_score)
        - embedding: list of 512 floats (ArcFace vector)
        - anti_spoof_score: float 0-1  (1.0 = likely real face)

    Raises ValueError if no face is detected.
    """
    s = get_settings()
    img = _decode_image(image_bytes)

    results = DeepFace.represent(
        img_path=img,
        model_name=s.deepface_model,          # "ArcFace"
        detector_backend=s.deepface_detector,  # "retinaface"
        enforce_detection=True,
    )

    if not results:
        raise ValueError("No face detected in image")

    embedding: list[float] = results[0]["embedding"]

    # Anti-spoofing — available in DeepFace >= 0.0.83
    # Fails closed (0.0 = reject) if the model or parameter is unavailable, since
    # silently trusting an unverifiable check would defeat the point of spoof detection.
    try:
        analysis = DeepFace.analyze(
            img_path=img,
            actions=["emotion"],
            enforce_detection=False,
            anti_spoofing=True,
            silent=True,
        )
        raw = analysis[0] if isinstance(analysis, list) else analysis
        anti_spoof_score = float(raw.get("antispoof_score", 0.0))
    except Exception as e:
        logger.warning("Anti-spoofing check failed, rejecting as unverified: %s", e)
        anti_spoof_score = 0.0

    return embedding, anti_spoof_score


def verify_face(
    stored_embedding: list[float],
    probe_embedding: list[float],
    threshold: float | None = None,
) -> tuple[bool, float]:
    """
    Compare a stored enrollment embedding against a live probe using cosine similarity.

    Returns:
        (is_match, similarity_score)
        - is_match: True if similarity >= threshold
        - similarity_score: float clamped to [-1, 1]
    """
    t = threshold if threshold is not None else get_settings().face_similarity_threshold

    a = np.array(stored_embedding, dtype=np.float32)
    b = np.array(probe_embedding, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return False, 0.0

    similarity = float(np.dot(a, b) / (norm_a * norm_b))
    return similarity >= t, round(similarity, 4)
