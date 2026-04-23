import os
from typing import Any

import requests
from google.cloud import storage

from report_generator import generate_selection_pdf

BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:4000")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")
REPORTS_BUCKET = os.getenv("REPORTS_BUCKET", os.getenv("GCS_BUCKET_NAME", "athleteiq-reports"))
GCS_PROJECT_ID = os.getenv("GCS_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID")


def _headers() -> dict[str, str]:
    return {
        "x-internal-token": INTERNAL_SERVICE_TOKEN,
        "Content-Type": "application/json",
    }


def _upload_pdf(report_id: str, athlete_id: str, payload: bytes) -> str:
    client = storage.Client(project=GCS_PROJECT_ID) if GCS_PROJECT_ID else storage.Client()
    bucket = client.bucket(REPORTS_BUCKET)
    blob = bucket.blob(f"selection-reports/{athlete_id}/{report_id}.pdf")
    blob.upload_from_string(payload, content_type="application/pdf")
    return f"gs://{REPORTS_BUCKET}/{blob.name}"


def generate_pdf_for_report(report_id: str) -> dict[str, Any]:
    details_response = requests.get(
        f"{BACKEND_INTERNAL_URL}/api/internal/reports/{report_id}/details",
        headers=_headers(),
        timeout=45,
    )
    details_response.raise_for_status()
    details = details_response.json()["data"]

    athlete = details["athlete"]
    videos = details["athlete"]["videos"]
    biomech = [video["biomechanicsReport"] for video in videos if video.get("biomechanicsReport")]
    gemini = [video["geminiAnalysis"] for video in videos if video.get("geminiAnalysis")]
    timeline = []
    for video in videos:
        timeline.append(
            {
                "id": video["id"],
                "type": video["type"],
                "processedAt": video.get("processedAt"),
                "compositeScore": None,
            }
        )

    report_data = {
        "id": details["id"],
        "compositeScore": details["compositeScore"],
        "selectionDecision": details["selectionDecision"],
        "decisionReason": details.get("decisionReason"),
        "videos": timeline,
    }
    athlete_profile = {
        "name": athlete["user"]["name"],
        "sport": athlete.get("sport"),
        "region": athlete.get("region"),
    }

    pdf_bytes = generate_selection_pdf(
        report=report_data,
        athlete_profile=athlete_profile,
        gemini_analysis=gemini,
        biomechanics=biomech,
    )

    pdf_url = _upload_pdf(details["id"], details["athleteId"], pdf_bytes)
    save_response = requests.patch(
        f"{BACKEND_INTERNAL_URL}/api/internal/reports/{report_id}/pdf",
        headers=_headers(),
        json={"reportPdfUrl": pdf_url},
        timeout=30,
    )
    save_response.raise_for_status()
    return {"reportId": report_id, "reportPdfUrl": pdf_url}
