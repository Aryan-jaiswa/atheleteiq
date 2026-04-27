"""
Google Cloud Storage client for motion service
Handles downloading videos and uploading frames
"""

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from google.cloud import storage

logger = logging.getLogger(__name__)

LOCAL_STORAGE_ROOT = Path("/tmp/athleteiq-local-storage")
USE_LOCAL_STORAGE = (
    os.getenv("GCS_PROJECT_ID") == "your-gcp-project-id"
    or not os.getenv("GOOGLE_CLOUD_CREDENTIALS")
)

if USE_LOCAL_STORAGE:
    LOCAL_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    logger.warning("⚠️  Using local file storage (GCS not configured)")


class GCSClient:
    """Storage client with GCS and local filesystem modes."""

    def __init__(self):
        self.project_id = os.getenv("GCS_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID")
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "athleteiq-videos")
        self.use_local_storage = USE_LOCAL_STORAGE
        self.client = None
        self.bucket = None

        if self.use_local_storage:
            return

        if not self.project_id:
            raise ValueError("GCS_PROJECT_ID or FIREBASE_PROJECT_ID must be set")

        credentials_json = os.getenv("GOOGLE_CLOUD_CREDENTIALS")
        if credentials_json:
            try:
                credentials_dict = json.loads(credentials_json)
                cred_file = "/tmp/gcs_credentials.json"
                with open(cred_file, "w", encoding="utf-8") as file_obj:
                    json.dump(credentials_dict, file_obj)
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_file
            except json.JSONDecodeError:
                logger.error("Invalid GOOGLE_CLOUD_CREDENTIALS JSON")

        self.client = storage.Client(project=self.project_id)
        self.bucket = self.client.bucket(self.bucket_name)
        logger.info(
            "GCS client initialized (project=%s, bucket=%s)",
            self.project_id,
            self.bucket_name,
        )

    def _normalize_blob_name(self, blob_name: str) -> str:
        if blob_name.startswith("gs://"):
            blob_name = blob_name[5:]
            if blob_name.startswith(f"{self.bucket_name}/"):
                blob_name = blob_name[len(self.bucket_name) + 1 :]
        return blob_name.lstrip("/")

    def _local_path(self, blob_name: str) -> Path:
        normalized = self._normalize_blob_name(blob_name)
        path = LOCAL_STORAGE_ROOT / normalized
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def upload_file(self, source_path: str, destination_blob_name: str) -> bool:
        try:
            if self.use_local_storage:
                destination = self._local_path(destination_blob_name)
                shutil.copy2(source_path, destination)
                return True

            blob = self.bucket.blob(self._normalize_blob_name(destination_blob_name))
            blob.upload_from_filename(source_path)
            return True
        except Exception as exc:
            logger.error("Failed to upload file: %s", exc)
            return False

    def download_file(self, blob_name: str, destination_path: str) -> bool:
        try:
            if self.use_local_storage:
                source = self._local_path(blob_name)
                if not source.exists():
                    return False
                Path(destination_path).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination_path)
                return True

            blob = self.bucket.blob(self._normalize_blob_name(blob_name))
            blob.download_to_filename(destination_path)
            return True
        except Exception as exc:
            logger.error("Failed to download file: %s", exc)
            return False

    def get_signed_url(self, blob_name: str, expiration_minutes: int) -> str:
        if self.use_local_storage:
            normalized = self._normalize_blob_name(blob_name)
            return f"http://localhost:8000/local-media/{normalized}"

        blob = self.bucket.blob(self._normalize_blob_name(blob_name))
        return blob.generate_signed_url(version="v4", expiration=expiration_minutes * 60, method="GET")

    def download_video(self, gcs_path: str, local_path: str) -> bool:
        return self.download_file(gcs_path, local_path)

    def upload_frame(self, local_path: str, gcs_path: str) -> bool:
        return self.upload_file(local_path, gcs_path)

    def upload_frames_batch(self, local_dir: str, gcs_prefix: str) -> tuple[int, int]:
        successful = 0
        failed = 0

        try:
            prefix = gcs_prefix if gcs_prefix.endswith("/") else f"{gcs_prefix}/"
            for filename in sorted(os.listdir(local_dir)):
                if not filename.endswith(".jpg"):
                    continue
                local_path = os.path.join(local_dir, filename)
                gcs_path = f"{prefix}{filename}"
                if self.upload_frame(local_path, gcs_path):
                    successful += 1
                else:
                    failed += 1
            return successful, failed
        except Exception as exc:
            logger.error("Batch upload error: %s", exc)
            return successful, failed

    def get_public_url(self, gcs_path: str) -> str:
        normalized = self._normalize_blob_name(gcs_path)
        if self.use_local_storage:
            return f"http://localhost:8000/local-media/{normalized}"
        return f"https://storage.googleapis.com/{self.bucket_name}/{normalized}"

    def delete_file(self, gcs_path: str) -> bool:
        try:
            normalized = self._normalize_blob_name(gcs_path)
            if self.use_local_storage:
                local_path = self._local_path(normalized)
                if local_path.exists():
                    local_path.unlink()
                return True

            blob = self.bucket.blob(normalized)
            blob.delete()
            return True
        except Exception as exc:
            logger.error("Failed to delete file: %s", exc)
            return False

    def delete_folder(self, gcs_prefix: str) -> int:
        try:
            normalized = self._normalize_blob_name(gcs_prefix)
            prefix = normalized if normalized.endswith("/") else f"{normalized}/"

            if self.use_local_storage:
                base = LOCAL_STORAGE_ROOT / prefix
                if not base.exists():
                  return 0
                deleted = 0
                for path in sorted(base.rglob("*"), reverse=True):
                    if path.is_file():
                        path.unlink()
                        deleted += 1
                for path in sorted(base.rglob("*"), reverse=True):
                    if path.is_dir():
                        path.rmdir()
                if base.exists():
                    base.rmdir()
                return deleted

            blobs = self.client.list_blobs(self.bucket_name, prefix=prefix)
            deleted = 0
            for blob in blobs:
                blob.delete()
                deleted += 1
            return deleted
        except Exception as exc:
            logger.error("Failed to delete folder: %s", exc)
            return 0


_gcs_client: Optional[GCSClient] = None


def get_gcs_client() -> GCSClient:
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = GCSClient()
    return _gcs_client
