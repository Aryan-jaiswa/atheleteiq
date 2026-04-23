'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface VideoUploadState {
  step: 'form' | 'uploading' | 'confirming' | 'processing' | 'complete';
  videoId: string | null;
  signedUrl: string | null;
  progress: UploadProgress;
  isLoading: boolean;
  error: string | null;
  status: string | null;
  pipelineProgress: number; // 0-100
}

export interface UploadFormData {
  sport: string;
  type: 'TRAINING' | 'MATCH';
  durationSeconds: number;
  file: File;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useVideoUpload() {
  const [state, setState] = useState<VideoUploadState>({
    step: 'form',
    videoId: null,
    signedUrl: null,
    progress: { loaded: 0, total: 0, percentage: 0 },
    isLoading: false,
    error: null,
    status: null,
    pipelineProgress: 0,
  });

  /**
   * Get signed URL for video upload from backend
   */
  const getUploadUrl = useCallback(
    async (formData: UploadFormData): Promise<{
      videoId: string;
      signedUrl: string;
    } | null> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const response = await axios.post(`${API_URL}/api/videos/upload-url`, {
          sport: formData.sport,
          type: formData.type,
          durationSeconds: formData.durationSeconds,
        });

        const { videoId, signedUploadUrl } = response.data.data;

        setState((prev) => ({
          ...prev,
          videoId,
          signedUrl: signedUploadUrl,
          step: 'uploading',
          isLoading: false,
        }));

        return { videoId, signedUrl: signedUploadUrl };
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to get upload URL';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return null;
      }
    },
    []
  );

  /**
   * Upload video to GCS using signed URL
   * Uses XMLHttpRequest for better progress tracking
   */
  const uploadToGCS = useCallback(
    (signedUrl: string, file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setState((prev) => ({
              ...prev,
              progress: {
                loaded: e.loaded,
                total: e.total,
                percentage: percentComplete,
              },
            }));
          }
        });

        // Success
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setState((prev) => ({
              ...prev,
              progress: { loaded: 100, total: 100, percentage: 100 },
              step: 'confirming',
            }));
            resolve(true);
          } else {
            setState((prev) => ({
              ...prev,
              error: `Upload failed with status ${xhr.status}`,
              step: 'form',
            }));
            resolve(false);
          }
        });

        // Error
        xhr.addEventListener('error', () => {
          setState((prev) => ({
            ...prev,
            error: 'Network error during upload',
            step: 'form',
          }));
          resolve(false);
        });

        // Abort
        xhr.addEventListener('abort', () => {
          setState((prev) => ({
            ...prev,
            error: 'Upload cancelled',
            step: 'form',
          }));
          resolve(false);
        });

        // Send file
        xhr.open('PUT', signedUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    },
    []
  );

  /**
   * Confirm upload with backend (triggers queue job)
   */
  const confirmUpload = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      const response = await axios.post(`${API_URL}/api/videos/${videoId}/confirm`);

      setState((prev) => ({
        ...prev,
        videoId,
        step: 'processing',
        isLoading: false,
        status: 'QUEUED',
        pipelineProgress: 10,
      }));

      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to confirm upload';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, []);

  /**
   * Poll video status from backend
   */
  const pollVideoStatus = useCallback(
    (videoId: string, interval: number = 4000, maxAttempts: number = 300) => {
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/api/videos/${videoId}/status`);
          const { status, progress } = response.data.data;

          setState((prev) => ({
            ...prev,
            status,
            pipelineProgress: progress,
          }));

          // Pipeline stages with progress
          const progressMap: { [key: string]: number } = {
            QUEUED: 10,
            EXTRACTING_FRAMES: 33,
            POSE_DETECTION: 66,
            BIOMECHANICS: 80,
            GEMINI_ANALYSIS: 90,
            COMPLETE: 100,
            FAILED: 0,
          };

          if (status === 'COMPLETE') {
            clearInterval(pollInterval);
            setState((prev) => ({
              ...prev,
              step: 'complete',
              pipelineProgress: 100,
            }));
          } else if (status === 'FAILED') {
            clearInterval(pollInterval);
            setState((prev) => ({
              ...prev,
              error: `Processing failed: ${response.data.data.errorMessage}`,
              pipelineProgress: 0,
            }));
          }

          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setState((prev) => ({
              ...prev,
              error: 'Processing timeout - please check status later',
            }));
          }
        } catch (err) {
          console.error('Status polling error:', err);
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setState((prev) => ({
              ...prev,
              error: 'Failed to get status updates',
            }));
          }
        }
      }, interval);

      // Return cancel function
      return () => clearInterval(pollInterval);
    },
    []
  );

  /**
   * Handle full upload flow
   */
  const handleUpload = useCallback(
    async (formData: UploadFormData) => {
      // Step 1: Get signed URL
      const uploadData = await getUploadUrl(formData);
      if (!uploadData) return;

      // Step 2: Upload to GCS
      const uploadSuccess = await uploadToGCS(uploadData.signedUrl, formData.file);
      if (!uploadSuccess) return;

      // Step 3: Confirm upload
      const confirmSuccess = await confirmUpload(uploadData.videoId);
      if (!confirmSuccess) return;

      // Step 4: Start polling status
      const cancel = pollVideoStatus(uploadData.videoId);

      // Return cleanup function
      return cancel;
    },
    [getUploadUrl, uploadToGCS, confirmUpload, pollVideoStatus]
  );

  const reset = useCallback(() => {
    setState({
      step: 'form',
      videoId: null,
      signedUrl: null,
      progress: { loaded: 0, total: 0, percentage: 0 },
      isLoading: false,
      error: null,
      status: null,
      pipelineProgress: 0,
    });
  }, []);

  return {
    ...state,
    handleUpload,
    reset,
    pollVideoStatus,
  };
}
