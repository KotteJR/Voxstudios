'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';

interface Video {
  id: string;
  title: string;
  url: string;
}

export default function FinalDeliverablePage() {
  const { currentProject } = useProject();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (currentProject?.id) {
      // Fetch videos for the current project
      fetch(`/api/videos/${currentProject.id}/list`)
        .then(res => res.json())
        .then(data => {
          if (data.videos) {
            setVideos(data.videos.map((video: any) => ({
              id: video.name,
              title: video.name.split('.').slice(0, -1).join('.'), // Remove extension
              url: video.url
            })));
          }
        })
        .catch(error => console.error('Error fetching videos:', error));
    } else {
      setVideos([]);
    }
  }, [currentProject]);

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
    setVideoError(null);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleVideoError = () => {
    setVideoError('Error loading video. Please try again.');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">Final Deliverable</h1>

        {currentProject ? (
          <p className="mb-4 text-gray-700">
            Viewing final videos for: <span className="font-semibold">{currentProject.name}</span>
          </p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Available Videos</h2>
            <div className="space-y-2">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => handleVideoSelect(video)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedVideo?.id === video.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{video.title}</h3>
                </button>
              ))}
              {videos.length === 0 && (
                <p className="text-gray-500 text-center py-4">No videos available yet.</p>
              )}
            </div>
          </div>

          {/* Modern Player */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {selectedVideo ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    src={selectedVideo.url}
                    controls
                    playsInline
                    onError={handleVideoError}
                  />
                ) : (
                  <div className="text-gray-400 text-lg">Select a video to play</div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-700 truncate">
                  {selectedVideo ? selectedVideo.title : 'No video selected'}
                </div>
                {selectedVideo && (
                  <div className="space-x-2">
                    <a
                      href={selectedVideo.url}
                      download
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
              {videoError && (
                <div className="mt-2 text-sm text-red-600">{videoError}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      
    </div>
  );
} 