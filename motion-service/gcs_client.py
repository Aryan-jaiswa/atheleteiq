"""
Google Cloud Storage client for motion service
Handles downloading videos and uploading frames
"""

import os
import json
from google.cloud import storage
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class GCSClient:
    """Google Cloud Storage client for motion service"""

    def __init__(self):
        """Initialize GCS client"""
        self.project_id = os.getenv('GCS_PROJECT_ID') or os.getenv('FIREBASE_PROJECT_ID')
        self.bucket_name = os.getenv('GCS_BUCKET_NAME', 'athleteiq-videos')

        if not self.project_id:
            raise ValueError('GCS_PROJECT_ID or FIREBASE_PROJECT_ID must be set')

        # Initialize credentials
        credentials = None
        credentials_json = os.getenv('GOOGLE_CLOUD_CREDENTIALS')

        if credentials_json:
            try:
                credentials_dict = json.loads(credentials_json)
                # Save to temp file for google-cloud-storage library
                cred_file = '/tmp/gcs_credentials.json'
                with open(cred_file, 'w') as f:
                    json.dump(credentials_dict, f)
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_file
            except json.JSONDecodeError:
                logger.error('Invalid GOOGLE_CLOUD_CREDENTIALS JSON')

        # Initialize storage client
        self.client = storage.Client(project=self.project_id)
        self.bucket = self.client.bucket(self.bucket_name)

        logger.info(f'✅ GCS client initialized (project={self.project_id}, bucket={self.bucket_name})')

    def download_video(self, gcs_path: str, local_path: str) -> bool:
        """
        Download video from GCS to local filesystem

        Args:
            gcs_path: GCS path (e.g., gs://bucket-name/path/to/video.mp4 or path/to/video.mp4)
            local_path: Local file path to save to

        Returns:
            True if successful, False otherwise
        """
        try:
            # Clean up gs:// prefix if present
            if gcs_path.startswith('gs://'):
                gcs_path = gcs_path[5:]
                if gcs_path.startswith(self.bucket_name + '/'):
                    gcs_path = gcs_path[len(self.bucket_name) + 1:]

            logger.info(f'Downloading video from GCS: gs://{self.bucket_name}/{gcs_path}')

            blob = self.bucket.blob(gcs_path)
            blob.download_to_filename(local_path)

            logger.info(f'✅ Video downloaded to {local_path}')
            return True
        except Exception as e:
            logger.error(f'❌ Failed to download video: {str(e)}')
            return False

    def upload_frame(self, local_path: str, gcs_path: str) -> bool:
        """
        Upload single frame to GCS

        Args:
            local_path: Local file path
            gcs_path: GCS destination path (relative to bucket)

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f'Uploading frame to GCS: {gcs_path}')

            blob = self.bucket.blob(gcs_path)
            blob.upload_from_filename(local_path, content_type='image/jpeg')

            logger.info(f'✅ Frame uploaded: {gcs_path}')
            return True
        except Exception as e:
            logger.error(f'❌ Failed to upload frame: {str(e)}')
            return False

    def upload_frames_batch(self, local_dir: str, gcs_prefix: str) -> tuple[int, int]:
        """
        Upload all frames from local directory to GCS

        Args:
            local_dir: Local directory containing frames (frame_0001.jpg, frame_0002.jpg, etc.)
            gcs_prefix: GCS prefix for frames (e.g., frames/{videoId}/)

        Returns:
            Tuple of (successful_uploads, failed_uploads)
        """
        successful = 0
        failed = 0

        try:
            # Ensure gcs_prefix ends with /
            if not gcs_prefix.endswith('/'):
                gcs_prefix += '/'

            # List all JPG files in directory
            for filename in sorted(os.listdir(local_dir)):
                if filename.endswith('.jpg'):
                    local_path = os.path.join(local_dir, filename)
                    gcs_path = gcs_prefix + filename

                    if self.upload_frame(local_path, gcs_path):
                        successful += 1
                    else:
                        failed += 1

            logger.info(f'✅ Batch upload complete: {successful} successful, {failed} failed')
            return successful, failed

        except Exception as e:
            logger.error(f'❌ Batch upload error: {str(e)}')
            return successful, failed

    def get_public_url(self, gcs_path: str) -> str:
        """
        Get public URL for a GCS object

        Args:
            gcs_path: GCS path (relative to bucket)

        Returns:
            Public HTTPS URL
        """
        # Clean up gs:// prefix if present
        if gcs_path.startswith('gs://'):
            gcs_path = gcs_path[5:]
            if gcs_path.startswith(self.bucket_name + '/'):
                gcs_path = gcs_path[len(self.bucket_name) + 1:]

        return f'https://storage.googleapis.com/{self.bucket_name}/{gcs_path}'

    def delete_file(self, gcs_path: str) -> bool:
        """
        Delete a file from GCS

        Args:
            gcs_path: GCS path

        Returns:
            True if successful, False otherwise
        """
        try:
            # Clean up gs:// prefix if present
            if gcs_path.startswith('gs://'):
                gcs_path = gcs_path[5:]
                if gcs_path.startswith(self.bucket_name + '/'):
                    gcs_path = gcs_path[len(self.bucket_name) + 1:]

            blob = self.bucket.blob(gcs_path)
            blob.delete()

            logger.info(f'✅ File deleted: {gcs_path}')
            return True
        except Exception as e:
            logger.error(f'❌ Failed to delete file: {str(e)}')
            return False

    def delete_folder(self, gcs_prefix: str) -> int:
        """
        Delete all files with a given prefix from GCS

        Args:
            gcs_prefix: GCS prefix (folder path)

        Returns:
            Number of files deleted
        """
        try:
            # Ensure prefix ends with /
            if not gcs_prefix.endswith('/'):
                gcs_prefix += '/'

            blobs = self.client.list_blobs(self.bucket_name, prefix=gcs_prefix)
            deleted_count = 0

            for blob in blobs:
                blob.delete()
                deleted_count += 1

            logger.info(f'✅ Deleted {deleted_count} files from {gcs_prefix}')
            return deleted_count

        except Exception as e:
            logger.error(f'❌ Failed to delete folder: {str(e)}')
            return 0


# Singleton instance
_gcs_client: Optional[GCSClient] = None


def get_gcs_client() -> GCSClient:
    """Get or create GCS client singleton"""
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = GCSClient()
    return _gcs_client
