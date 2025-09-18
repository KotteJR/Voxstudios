'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useVoices } from '@/contexts/VoiceContext';
import { useProject } from '@/contexts/ProjectContext';

interface Feedback {
  id: string;
  timestamp: number;
  comment: string;
  resolved: boolean;
}

interface Voice {
  id: string;
  title: string;
  description: string;
  tags: string[];
  audioUrl?: string;
  type: 'base' | 'custom';
  uploadDate: string;
  projectId?: string;
  stageId?: string;
  isAIVoice?: boolean;
  feedback?: Feedback[];
}

export default function FeedbackSessionPage() {
  const { getAIVoicesForStage } = useVoices();
  const { currentProject } = useProject();
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [newComment, setNewComment] = useState('');
  const [duration, setDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Get selected voices from Stage 2
  const [stage3Voices, setStage3Voices] = useState<Array<{ title: string; url: string; webUrl: string }>>([]);
  const selectedVoices = currentProject
    ? getAIVoicesForStage(currentProject.id, 'stage2')
    : [];

  useEffect(() => {
    const loadStage3 = async () => {
      if (!currentProject) return setStage3Voices([]);
      try {
        const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`, { cache: 'no-store' });
        const data = await res.json();
        const list = (data?.files?.stage3_voiceEntries || []) as Array<{ title: string; url: string; webUrl: string }>; 
        setStage3Voices(list);
      } catch (e) {
        console.error('Failed to load Stage 3 voices:', e);
        setStage3Voices([]);
      }
    };
    loadStage3();
  }, [currentProject]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setIsPlaying(false);
        alert('Failed to load audio. The file may need to be re-uploaded. Please try uploading the voice again from the admin panel.');
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [selectedVoice]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && audioRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleAddFeedback = () => {
    if (newComment.trim() && selectedVoice) {
      const newFeedback: Feedback = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: currentTime,
        comment: newComment.trim(),
        resolved: false,
      };
      setFeedback([...feedback, newFeedback]);
      setNewComment('');
    }
  };

  const handleDeleteFeedback = (id: string) => {
    setFeedback(prev => prev.filter(f => f.id !== id));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVoiceSelect = async (voice: Voice) => {
    setSelectedVoice(voice);
    setCurrentTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    
    // Load existing feedback for this voice
    await loadFeedbackForVoice(voice);
  };

  const loadFeedbackForVoice = async (voice: Voice) => {
    if (!currentProject) return;
    
    try {
      console.log('Loading feedback for voice:', voice.title, 'in project:', currentProject.id);
      const response = await fetch(
        `/api/projects/feedback?projectId=${encodeURIComponent(currentProject.id)}&voiceTitle=${encodeURIComponent(voice.title)}`
      );
      
      console.log('Feedback API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Feedback API response data:', data);
        if (data.success && data.feedback) {
          console.log('Setting feedback:', data.feedback);
          setFeedback(data.feedback);
        } else {
          console.log('No feedback found or API returned success: false');
          setFeedback([]);
        }
      } else {
        console.error('Failed to load feedback, status:', response.status);
        setFeedback([]);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      setFeedback([]);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedVoice || !currentProject || feedback.length === 0) {
      alert('Please select a voice and add feedback before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      // Sort feedback by timestamp
      const sortedFeedback = [...feedback].sort((a, b) => a.timestamp - b.timestamp);

      // Generate feedback report content
      const reportContent = `
Voice Feedback Report
--------------------
Project: ${currentProject.name}
Voice: ${selectedVoice.title}
Date: ${new Date().toLocaleString()}

Feedback Comments:
${sortedFeedback.map(fb => `[${formatTime(fb.timestamp)}] ${fb.comment} ${fb.resolved ? '(Resolved)' : '(Pending)'}`).join('\n')}
`;

      // Create a text file with the feedback (include timestamp to avoid overwriting)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File(
        [reportContent], 
        `feedback_${currentProject.name}_${selectedVoice.title}_${timestamp}.txt`,
        { type: 'text/plain' }
      );

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectName', currentProject.name);
      formData.append('stage', 'stage3');
      formData.append('folderName', 'feedback');

      // Upload the feedback file to Teams
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload feedback report');
      }

      alert('Feedback submitted successfully!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Feedback Session</h1>
          {feedback.length > 0 && selectedVoice && (
            <button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          )}
        </div>

        {currentProject ? (
          <p className="mb-4 text-gray-700">
            Reviewing voices for: <span className="font-semibold">{currentProject.name}</span>
          </p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voice List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Selected Voices</h2>
            <div className="grid grid-cols-1 gap-4">
              {stage3Voices.length > 0
                ? stage3Voices.map((v) => (
                  <button
                    key={v.title}
                    onClick={() => handleVoiceSelect({ id: v.title, title: v.title, description: '', tags: [], audioUrl: v.url, type: 'custom', uploadDate: new Date().toISOString() })}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedVoice?.title === v.title
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900">{v.title}</h3>
                  </button>
                ))
                : selectedVoices.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => handleVoiceSelect(voice)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedVoice?.id === voice.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <h3 className="text-base font-medium text-gray-900">{voice.title}</h3>
                    {voice.description && (
                      <p className="mt-1 text-sm text-gray-500 truncate">{voice.description}</p>
                    )}
                  </button>
                ))}
            </div>
            {(stage3Voices.length === 0 && selectedVoices.length === 0) && (
              <div className="text-center text-gray-500 text-sm py-8">No voices available.</div>
            )}
          </div>

          {/* Audio Player and Feedback */}
          <div className="lg:col-span-2">
            {selectedVoice ? (
              <div className="space-y-6">
                {/* Audio Player */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">{selectedVoice.title}</h2>
                      <button
                        onClick={handlePlayPause}
                        className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        {isPlaying ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Timeline */}
                    <div 
                      ref={timelineRef}
                      onClick={handleTimelineClick}
                      className="h-2 bg-gray-200 rounded-full cursor-pointer relative"
                    >
                      <div 
                        className="absolute h-full bg-blue-500 rounded-full"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                      {feedback.map((fb) => (
                        <div
                          key={fb.id}
                          className={`absolute w-2 h-2 -mt-1 rounded-full transform -translate-x-1/2 ${
                            fb.resolved ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                          style={{ left: `${(fb.timestamp / duration) * 100}%` }}
                          title={fb.comment}
                        />
                      ))}
                    </div>

                    <div className="flex justify-between text-sm text-gray-500">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Input */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add Feedback</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type your feedback here..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddFeedback}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Feedback List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Feedback List</h3>
                  <div className="space-y-3">
                    {feedback.map((fb) => (
                      <div key={fb.id} className="flex items-start gap-4 p-3 rounded-lg bg-gray-50">
                        <button
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = fb.timestamp;
                              setCurrentTime(fb.timestamp);
                            }
                          }}
                          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
                          title="Jump to time"
                        >
                          {formatTime(fb.timestamp)}
                        </button>
                        <p className="flex-1 text-gray-700">{fb.comment}</p>
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove"
                          aria-label="Remove"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {feedback.length === 0 && (
                      <div className="text-center text-gray-500 text-sm">No feedback yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500">Select a voice to start providing feedback</p>
              </div>
            )}
          </div>
        </div>

        <audio ref={audioRef} src={selectedVoice?.audioUrl} className="hidden" />
      </div>
    </div>
  );
} 