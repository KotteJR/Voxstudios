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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectName', currentProject.name);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

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
      setProgress(100);
    }
  };

  const refreshList = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`);
      const data = await res.json();
      if (data?.files?.videos) setUploaded(data.files.videos);
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