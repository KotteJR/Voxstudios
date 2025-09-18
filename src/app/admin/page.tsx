'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useVoices } from '@/contexts/VoiceContext';
import { useProject } from '@/contexts/ProjectContext';
import { 
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface VoiceDetails {
  title: string;
  description: string;
  tags: string;
  type: 'base' | 'custom';
  projectId?: string;
  stageId?: string;
  isAIVoice?: boolean;
  audioData: string; // Still needed for upload process
}

interface VideoDetails {
  title: string;
  projectId: string;
}

// Storage Monitor Component
function StorageMonitor() {
  const { getStorageInfo, clearOldVoices } = useVoices();
  const [storageInfo, setStorageInfo] = useState(() => {
    // Only access localStorage on client side to prevent hydration errors
    if (typeof window !== 'undefined') {
      return getStorageInfo();
    }
    return { used: 0, available: 0, percentage: 0 };
  });
  const [isClient, setIsClient] = useState(false);

  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsClient(true);
    setStorageInfo(getStorageInfo());
  }, []);

  const updateStorageInfo = () => {
    setStorageInfo(getStorageInfo());
  };

  const handleCleanup = () => {
    clearOldVoices();
    updateStorageInfo();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Storage Usage</h2>
        <button
          onClick={updateStorageInfo}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          Refresh
        </button>
      </div>
      
      <div className="space-y-4">
        {isClient ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Used: {formatBytes(storageInfo.used)}</span>
              <span className="text-sm text-gray-600">Available: {formatBytes(storageInfo.available)}</span>
            </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              storageInfo.percentage >= 90 ? 'bg-red-500' :
              storageInfo.percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
          />
        </div>
        
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(storageInfo.percentage)}`}>
          {storageInfo.percentage >= 90 && <ExclamationTriangleIcon className="w-4 h-4 mr-1" />}
          {storageInfo.percentage.toFixed(1)}% used
        </div>
        
        {storageInfo.percentage >= 70 && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2" />
              <span className="text-sm text-yellow-800">
                {storageInfo.percentage >= 90 
                  ? 'Storage is nearly full! Clean up old voices to prevent upload failures.'
                  : 'Storage usage is high. Consider cleaning up old voices.'
                }
              </span>
            </div>
            <button
              onClick={handleCleanup}
              className="flex items-center px-3 py-1 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
            >
              <TrashIcon className="w-4 h-4 mr-1" />
              Clean Up
            </button>
          </div>
        )}
          </>
        ) : (
          <div className="text-sm text-gray-500">Loading storage information...</div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();
  const { addVoice, clearOldVoices, getStorageInfo } = useVoices();
  const { projects, currentProject } = useProject();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [voiceDetails, setVoiceDetails] = useState<VoiceDetails>({
    title: '',
    description: '',
    tags: '',
    type: 'base',
    projectId: '',
    stageId: '',
    isAIVoice: false,
    audioData: ''
  });
  const [videoDetails, setVideoDetails] = useState<VideoDetails>({
    title: '',
    projectId: currentProject?.id || '',
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      try {
        const base64Data = await convertFileToBase64(file);
        setVoiceDetails(prev => ({
          ...prev,
          audioData: base64Data
        }));
      } catch (error) {
        console.error('Error converting file:', error);
        alert('Failed to process audio file. Please try again.');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      try {
        const base64Data = await convertFileToBase64(file);
        setVoiceDetails(prev => ({
          ...prev,
          audioData: base64Data
        }));
      } catch (error) {
        console.error('Error converting file:', error);
        alert('Failed to process audio file. Please try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !voiceDetails.audioData) {
      alert('Please select an audio file');
      return;
    }

    // Validate project selection for all voices
    if (!voiceDetails.projectId) {
      alert('Please select a project');
      return;
    }

    setIsUploading(true);
    try {
      // First, upload the file to SharePoint
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectName', voiceDetails.projectId);
      formData.append('stage', voiceDetails.stageId || 'stage1');
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message || 'Upload failed');
      }

      // Create proxy URL for audio playback with file path info
      const proxyAudioUrl = `/api/audio-proxy?filePath=${encodeURIComponent(uploadResult.filePath)}&siteId=${uploadResult.siteId}&driveId=${uploadResult.driveId}`;

      // Then add the voice metadata to the context with the proxy URL
      await addVoice({
        title: voiceDetails.title,
        description: voiceDetails.description,
        tags: voiceDetails.tags.split(',').map(tag => tag.trim()),
        type: voiceDetails.type,
        audioUrl: proxyAudioUrl, // Use proxy URL for playback
        projectId: voiceDetails.projectId,
        stageId: voiceDetails.stageId,
        isAIVoice: voiceDetails.isAIVoice
      });

      // Reset form
      setSelectedFile(null);
      setVoiceDetails({
        title: '',
        description: '',
        tags: '',
        type: 'base',
        projectId: '',
        stageId: '',
        isAIVoice: false,
        audioData: ''
      });

      alert('Voice uploaded successfully!');
    } catch (error) {
      console.error('Error uploading voice:', error);
      alert('Failed to upload voice. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentProject) {
      setUploadError('Please select a file and project first');
      return;
    }

    // Check file size for Vercel limitations
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB in bytes
    if (file.size > maxSize) {
      setUploadError(
        `File size (${formatFileSize(file.size)}) exceeds Vercel limit (4.5MB). ` +
        'Please compress your video or use a different upload method.'
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectName', currentProject.name); // Use projectName like other stages
      formData.append('stage', 'stage4'); // Upload to stage4 like other stages
      // Store like Stage 1: rely on file type to place under stage4/videos
      // formData.append('folderName', 'videos'); // Optional explicit override

      const response = await fetch('/api/upload', { // Use standard upload endpoint
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Upload failed:', response.status, errorData);
        
        // Handle specific Vercel 413 error
        if (response.status === 413) {
          throw new Error(
            'File too large for Vercel deployment. Please compress your video to under 4.5MB or use a different upload method.'
          );
        }
        
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      setUploadSuccess(true);
      setVideoDetails(prev => ({ ...prev, title: '' }));
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload video. Please try again.';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

        {/* Storage Monitoring Section */}
        <StorageMonitor />

        {/* Voice Upload Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Voice</h2>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Upload New Voice</h2>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Stage:</label>
              <button
                onClick={() => setVoiceDetails(prev => ({ 
                  ...prev, 
                  isAIVoice: false,
                  stageId: 'stage1'
                }))}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  voiceDetails.stageId === 'stage1'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Stage 1
              </button>
              <button
                onClick={() => setVoiceDetails(prev => ({ 
                  ...prev, 
                  isAIVoice: true,
                  stageId: 'stage2'
                }))}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  voiceDetails.stageId === 'stage2'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Stage 2
              </button>
              <button
                onClick={() => setVoiceDetails(prev => ({ 
                  ...prev, 
                  isAIVoice: true,
                  stageId: 'stage3'
                }))}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  voiceDetails.stageId === 'stage3'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Stage 3
              </button>
            </div>
          </div>
          
          {/* Drag and Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200 ease-in-out
              ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}
            `}
          >
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop your audio file here, or
              <label className="ml-1 text-indigo-600 hover:text-indigo-500 cursor-pointer">
                <span> browse</span>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileChange}
                />
              </label>
            </p>
            {selectedFile && (
              <p className="mt-2 text-sm text-indigo-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Voice Details Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project Selection - Always show */}
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700">
                Project
              </label>
              <select
                id="project"
                value={voiceDetails.projectId}
                onChange={(e) => setVoiceDetails({ ...voiceDetails, projectId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Type Selection */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Voice Type
              </label>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div
                  className={`
                    border rounded-lg p-4 cursor-pointer text-center transition-all
                    ${voiceDetails.type === 'base'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                      : 'border-gray-300 hover:border-indigo-400'
                    }
                  `}
                  onClick={() => setVoiceDetails({ ...voiceDetails, type: 'base' })}
                >
                  <span className={`text-sm font-medium ${voiceDetails.type === 'base' ? 'text-indigo-700' : 'text-gray-900'}`}>
                    Base Voice
                  </span>
                </div>
                <div
                  className={`
                    border rounded-lg p-4 cursor-pointer text-center transition-all
                    ${voiceDetails.type === 'custom'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                      : 'border-gray-300 hover:border-indigo-400'
                    }
                  `}
                  onClick={() => setVoiceDetails({ ...voiceDetails, type: 'custom' })}
                >
                  <span className={`text-sm font-medium ${voiceDetails.type === 'custom' ? 'text-indigo-700' : 'text-gray-900'}`}>
                    Custom Voice
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={voiceDetails.title}
                onChange={(e) => setVoiceDetails({ ...voiceDetails, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                value={voiceDetails.description}
                onChange={(e) => setVoiceDetails({ ...voiceDetails, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                value={voiceDetails.tags}
                onChange={(e) => setVoiceDetails({ ...voiceDetails, tags: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g., male, professional, corporate"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${(!selectedFile || isUploading) 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
            >
              {isUploading ? 'Uploading...' : 'Upload Voice'}
            </button>
          </form>
        </div>

        {/* Final Video Upload Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Final Video</h2>
          
          {currentProject ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Uploading to project: <span className="font-medium">{currentProject.name}</span>
              </p>

              <div>
                <label htmlFor="videoTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Video Title
                </label>
                <input
                  type="text"
                  id="videoTitle"
                  value={videoDetails.title}
                  onChange={(e) => setVideoDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter video title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Video File
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="video-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload a video</span>
                        <input
                          id="video-upload"
                          name="video-upload"
                          type="file"
                          accept="video/*"
                          className="sr-only"
                          onChange={handleVideoUpload}
                          disabled={isUploading}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">MP4, WebM, or other video formats</p>
                    <p className="text-xs text-amber-600 font-medium">⚠️ Maximum file size: 4.5MB (Vercel limit)</p>
                  </div>
                </div>
              </div>

              {isUploading && (
                <div className="text-sm text-gray-600">
                  Uploading video...
                </div>
              )}

              {uploadSuccess && (
                <div className="text-sm text-green-600">
                  Video uploaded successfully!
                </div>
              )}

              {uploadError && (
                <div className="text-sm text-red-600">
                  {uploadError}
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-600">Please select a project first to upload videos.</p>
          )}
        </div>
      </div>
    </div>
  );
} 