'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Array<{ name: string; size: number; webUrl: string; mimeType?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentProject } = useProject();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('video/')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a video file');
        setFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please select a video file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!currentProject) {
      setError('No project selected. Please select a project first.');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1) Create an upload session to bypass Vercel body size limits
      const sessionRes = await fetch('/api/upload/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: currentProject.name,
          stage: 'stage1',
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create upload session');
      }
      const { uploadUrl } = await sessionRes.json();

      // 2) Upload in chunks directly to Graph
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      let offset = 0;
      let chunkIndex = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const chunkBuffer = await chunk.arrayBuffer();
        const contentRange = `bytes ${offset}-${offset + chunkBuffer.byteLength - 1}/${file.size}`;
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunkBuffer.byteLength),
            'Content-Range': contentRange,
          },
          body: chunkBuffer,
        });
        if (!putRes.ok && putRes.status !== 202 && putRes.status !== 201) {
          const errText = await putRes.text().catch(() => '');
          throw new Error(`Chunk upload failed (${putRes.status}): ${errText}`);
        }
        chunkIndex += 1;
        offset += chunkBuffer.byteLength;
        setProgress(Math.min(99, Math.round((chunkIndex / totalChunks) * 100)));
      }
      setProgress(100);

      // Reset form
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      alert('Upload completed successfully!');
      // Refresh list
      await refreshList();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const refreshList = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`);
      const data = await res.json();
      // Check both new stage-based structure and legacy structure
      if (data?.files?.['stage1_videos']) {
        setUploaded(data.files['stage1_videos']);
      } else if (data?.files?.videos) {
        setUploaded(data.files.videos);
      }
    } catch (e) {
      console.error('Failed to load video list:', e);
    }
  };

  const handleDelete = async (name: string) => {
    if (!currentProject) return;
    if (!confirm(`Remove ${name}?`)) return;
    try {
      const res = await fetch('/api/projects/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id, category: 'videos', name })
      });
      if (!res.ok) throw new Error('Delete failed');
      await refreshList();
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete file');
    }
  };

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">Video Upload</h1>
        
        {currentProject ? (
          <p className="mb-4 text-gray-700">Uploading to project: <span className="font-semibold">{currentProject.name}</span></p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mb-6 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*"
            className="hidden"
            id="video-upload"
          />
          <label
            htmlFor="video-upload"
            className="block cursor-pointer"
          >
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg text-gray-700 mb-2">
              {file ? file.name : 'Drag and drop your video here or click to browse'}
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: MP4, MOV, AVI
            </p>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isUploading || !file || !currentProject}
          className={`w-full py-3 px-8 rounded-lg font-medium text-base transition-all duration-200
            ${isUploading || !file || !currentProject
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'} 
            text-white`}
        >
          {isUploading ? `Uploading... ${progress}%` : 'Upload Video'}
        </button>

        {/* Uploaded videos list */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Uploaded Videos</h2>
          {uploaded.length === 0 ? (
            <p className="text-sm text-gray-500">No videos uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
              {uploaded.map((v) => (
                <li key={v.name} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 mr-4">
                    <a href={v.webUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline break-all">
                      {v.name}
                    </a>
                    <div className="text-xs text-gray-500">{(v.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                  <button
                    onClick={() => handleDelete(v.name)}
                    className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 