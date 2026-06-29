import base64
import numpy as np
import cv2
from deepface import DeepFace


def analyze_frame(frame_b64: str) -> dict:
    """
    Analyze the dominant emotion from a base64-encoded JPEG/PNG video frame.

    DeepFace returns emotion scores as percentages (0-100).
    We normalize them to 0-1 before returning.

    Returns:
        {
            "dominant_emotion": "happy",
            "scores": {"happy": 0.92, "neutral": 0.05, ...},
            "confidence": 0.92
        }

    Raises ValueError if the image cannot be decoded.
    """
    img_bytes = base64.b64decode(frame_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image frame")

    results = DeepFace.analyze(
        img_path=img,
        actions=["emotion"],
        enforce_detection=False,  # returns neutral scores instead of crashing when no face found
        silent=True,
    )

    face = results[0] if isinstance(results, list) else results

    raw_scores: dict = face.get("emotion", {})
    dominant: str = face.get("dominant_emotion", "neutral")

    normalized = {k.lower(): round(float(v) / 100, 4) for k, v in raw_scores.items()}
    confidence = round(max(normalized.values(), default=0.0), 4)

    return {
        "dominant_emotion": dominant,
        "scores": normalized,
        "confidence": confidence,
    }
