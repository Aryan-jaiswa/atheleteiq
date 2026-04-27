'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface VideoItem {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  thumbnailUrl?: string | null;
}

function mapVideo(video: any): VideoItem {
  return {
    id: video.id,
    title: video.title ?? `${video.type ?? 'Video'} ${video.sport ?? ''}`.trim(),
    createdAt: video.createdAt ?? video.uploadedAt ?? '',
    status: video.status ?? 'UNKNOWN',
    thumbnailUrl: video.thumbnailUrl ?? null,
  };
}

export default function UploadPage() {
  const { user, getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);

  const fetchVideos = async () => {
    setVideosLoading(true);

    try {
      const token = (await getToken()) ?? 'dev-bypass-token';
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const response = await axios.get(`${API_URL}/api/videos`, { headers });
        const apiVideos = Array.isArray(response.data?.data) ? response.data.data : [];
        setVideos(apiVideos.map(mapVideo));
      } catch {
        const athleteId = user?.athleteProfile?.id;

        if (!athleteId) {
          setVideos([]);
          return;
        }

        const response = await axios.get(`${API_URL}/api/videos/athlete/${athleteId}`, {
          headers,
        });
        const apiVideos = Array.isArray(response.data?.data) ? response.data.data : [];
        setVideos(apiVideos.map(mapVideo));
      }
    } catch {
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [user?.athleteProfile?.id]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setError(null);
      setFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = (await getToken()) ?? 'dev-bypass-token';
      await axios.post(`${API_URL}/api/videos/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (event) => {
          const percentage = Math.round((event.loaded * 100) / (event.total || 1));
          setProgress(percentage);
        },
      });

      setSuccess(true);
      await fetchVideos();
      setTimeout(() => {
        setSuccess(false);
        setFile(null);
        setProgress(0);
      }, 3000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      const apiMessage =
        typeof error?.response?.data?.message === 'string' ? error.response.data.message : null;
      setError(apiMessage ?? error?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block">
          Back
        </Link>

        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Upload & Analyze Video
          </h1>
          <p className="text-gray-300 text-lg">
            Upload athlete videos for real-time biomechanical analysis
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 border-2 border-dashed border-cyan-500/50 rounded-2xl p-12 text-center hover:border-cyan-400 transition-all cursor-pointer group"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">Video</div>
            <h3 className="text-2xl font-bold mb-2">Drop Video Here</h3>
            <p className="text-gray-400 mb-6">or click to select MP4, MOV, or AVI</p>

            {file && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
                <p className="text-green-400">{file.name}</p>
              </div>
            )}

            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] || null);
              }}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg cursor-pointer inline-block transition-all"
            >
              Select File
            </label>

            {file && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="ml-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50 transition-all"
              >
                {uploading ? `Uploading... ${progress}%` : 'Upload'}
              </button>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/15 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {uploading && (
              <div className="mt-6 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {success && (
              <div className="mt-6 bg-green-500/20 border border-green-500 text-green-400 rounded-lg p-4 animate-pulse">
                Video uploaded successfully!
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-6">Analysis Features</h3>
            {[
              { icon: 'Pose', title: 'Pose Detection', desc: 'MediaPipe 33-keypoint analysis' },
              { icon: 'Metrics', title: 'Biomechanics', desc: 'Joint angles & velocities' },
              { icon: 'AI', title: 'AI Analysis', desc: 'Gemini-powered insights' },
              { icon: 'Risk', title: 'Injury Risk', desc: 'Predictive ML models' },
            ].map((feature, i) => (
              <div
                key={i}
                className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all transform hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{feature.icon}</span>
                  <div>
                    <h4 className="font-semibold text-cyan-400">{feature.title}</h4>
                    <p className="text-sm text-gray-400">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h3 className="text-2xl font-bold mb-6">Recent Uploads</h3>

          {videosLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-cyan-400"></div>
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-gray-400">
              No videos yet
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-all"
                >
                  <div className="bg-gray-700 h-32 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-gray-400">Preview</span>
                    )}
                  </div>
                  <h4 className="font-semibold">{video.title}</h4>
                  <p className="text-sm text-gray-400">
                    {video.createdAt ? new Date(video.createdAt).toLocaleString() : 'Unknown date'}
                  </p>
                  <p className="mt-2 text-xs font-semibold tracking-wide text-cyan-300">
                    {video.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
