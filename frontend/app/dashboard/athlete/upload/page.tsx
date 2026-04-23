'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { useVideoUpload, UploadFormData } from '@/hooks/useVideoUpload';
import Image from 'next/image';

const SPORTS = [
  'Soccer',
  'Basketball',
  'Track and Field',
  'Tennis',
  'American Football',
  'Baseball',
  'Volleyball',
  'Swimming',
  'Golf',
  'Ice Hockey',
];

const PIPELINE_STAGES = [
  { name: 'Upload', status: 'upload', color: 'bg-blue-500' },
  { name: 'Frame Extraction', status: 'EXTRACTING_FRAMES', color: 'bg-purple-500' },
  { name: 'Pose Detection', status: 'POSE_DETECTION', color: 'bg-green-500' },
  { name: 'Biomechanics', status: 'BIOMECHANICS', color: 'bg-yellow-500' },
  { name: 'AI Analysis', status: 'GEMINI_ANALYSIS', color: 'bg-red-500' },
  { name: 'Complete', status: 'COMPLETE', color: 'bg-emerald-500' },
];

export default function VideoUploadPage() {
  const { user } = useAuth();
  const {
    step,
    videoId,
    progress,
    isLoading,
    error,
    status,
    pipelineProgress,
    handleUpload,
    reset,
  } = useVideoUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    sport: '',
    type: 'TRAINING' as 'TRAINING' | 'MATCH',
    file: null as File | null,
    fileName: '',
    durationSeconds: 0,
  });

  const [validationError, setValidationError] = useState('');

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Only MP4, MOV, and AVI files are supported');
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setValidationError('File size must be less than 500MB');
      return;
    }

    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      file,
      fileName: file.name,
    }));
  };

  // Handle duration input
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value) || 0;
    if (duration > 600) {
      setValidationError('Maximum video duration is 10 minutes (600 seconds)');
      return;
    }
    setValidationError('');
    setFormData((prev) => ({
      ...prev,
      durationSeconds: duration,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sport || !formData.file || !formData.durationSeconds) {
      setValidationError('Please fill in all fields');
      return;
    }

    if (formData.durationSeconds <= 0 || formData.durationSeconds > 600) {
      setValidationError('Duration must be between 0 and 600 seconds');
      return;
    }

    setValidationError('');

    const uploadData: UploadFormData = {
      sport: formData.sport,
      type: formData.type,
      durationSeconds: formData.durationSeconds,
      file: formData.file,
    };

    await handleUpload(uploadData);
  };

  // Get current stage
  const getCurrentStage = () => {
    if (pipelineProgress >= 100) return 'COMPLETE';
    if (pipelineProgress >= 90) return 'GEMINI_ANALYSIS';
    if (pipelineProgress >= 80) return 'BIOMECHANICS';
    if (pipelineProgress >= 66) return 'POSE_DETECTION';
    if (pipelineProgress >= 33) return 'EXTRACTING_FRAMES';
    if (pipelineProgress > 10) return 'upload';
    return 'upload';
  };

  return (
    <RoleGuard allowedRoles={['ATHLETE']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Upload Video</h1>
            <p className="text-lg text-slate-600">
              Upload your training or match video for AI-powered biomechanics analysis
            </p>
          </div>

          {/* Upload Form or Processing Status */}
          {step === 'form' ? (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sport Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Sport
                  </label>
                  <select
                    value={formData.sport}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, sport: e.target.value }));
                      setValidationError('');
                    }}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={isLoading}
                  >
                    <option value="">Select a sport...</option>
                    {SPORTS.map((sport) => (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Video Type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Video Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="TRAINING"
                        checked={formData.type === 'TRAINING'}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, type: e.target.value as any }))
                        }
                        className="w-4 h-4"
                      />
                      <span className="ml-2 text-slate-700">Training</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="type"
                        value="MATCH"
                        checked={formData.type === 'MATCH'}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, type: e.target.value as any }))
                        }
                        className="w-4 h-4"
                      />
                      <span className="ml-2 text-slate-700">Match</span>
                    </label>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={formData.durationSeconds || ''}
                    onChange={handleDurationChange}
                    placeholder="Enter video duration in seconds (max 600)"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-slate-500 mt-1">Maximum 10 minutes (600 seconds)</p>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Video File
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isLoading}
                    />

                    {formData.fileName ? (
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-green-600">✅ File selected</p>
                        <p className="text-sm text-slate-600">{formData.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {(formData.file!.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-slate-700">Click to upload</p>
                        <p className="text-sm text-slate-500">or drag and drop</p>
                        <p className="text-xs text-slate-400">MP4, MOV, or AVI (max 500MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {validationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">{validationError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !formData.file || !formData.sport || !formData.durationSeconds}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition"
                >
                  {isLoading ? 'Processing...' : 'Start Upload'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-8">
              {/* Video ID */}
              <div className="mb-8 pb-8 border-b border-slate-200">
                <p className="text-sm text-slate-600">Video ID</p>
                <p className="text-lg font-mono text-slate-900">{videoId}</p>
              </div>

              {/* Pipeline Visualization */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Processing Pipeline</h3>

                <div className="space-y-4">
                  {PIPELINE_STAGES.map((stage, index) => {
                    const isActive = getCurrentStage() === stage.status;
                    const isComplete =
                      stage.status === 'COMPLETE'
                        ? pipelineProgress === 100
                        : PIPELINE_STAGES.findIndex((s) => s.status === getCurrentStage()) > index;

                    return (
                      <div key={stage.status}>
                        <div className="flex items-center gap-4 mb-2">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white transition-all ${
                              isComplete || isActive
                                ? stage.color
                                : 'bg-slate-300'
                            }`}
                          >
                            {isComplete ? '✓' : index + 1}
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold ${
                              isActive
                                ? 'text-slate-900'
                                : isComplete
                                ? 'text-green-600'
                                : 'text-slate-500'
                            }`}>
                              {stage.name}
                            </p>
                          </div>
                          {isActive && (
                            <span className="text-sm text-blue-600 font-medium">In Progress</span>
                          )}
                          {isComplete && !isActive && (
                            <span className="text-sm text-green-600 font-medium">Complete</span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isActive && (
                          <div className="ml-14 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${Math.max(20, pipelineProgress - 30)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload Progress Bar */}
              {(step === 'uploading' || step === 'confirming') && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Upload Progress</h3>
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-600">
                      {progress.percentage}% ({(progress.loaded / (1024 * 1024)).toFixed(2)} /{' '}
                      {(progress.total / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  </div>
                </div>
              )}

              {/* Status Information */}
              <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Status</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {step === 'uploading' ? 'Uploading...' : status || 'Processing...'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Progress</p>
                    <p className="text-lg font-semibold text-slate-900">{pipelineProgress}%</p>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
                  <p className="font-semibold text-red-900 mb-2">Error</p>
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Completion Actions */}
              {step === 'complete' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <p className="text-green-900 font-semibold mb-2">✅ Upload Complete!</p>
                    <p className="text-green-700">Your video is now being analyzed. You'll receive updates as processing progresses.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        reset();
                        window.location.href = '/dashboard/athlete';
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                    >
                      View Dashboard
                    </button>
                    <button
                      onClick={reset}
                      className="border border-slate-300 hover:bg-slate-50 text-slate-900 font-semibold py-3 rounded-lg transition"
                    >
                      Upload Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
