'use client';

import React, { useState, useRef } from 'react';
import { useVoices } from '@/contexts/VoiceContext';
import { useProject } from '@/contexts/ProjectContext';

interface Voice {
  id: string;
  title: string;
  description: string;
  tags: string[];
  audioData: string;
  type: 'base' | 'custom';
  uploadDate: string;
  projectId?: string;
  stageId?: string;
  isAIVoice?: boolean;
}

export default function AIPoweredVersionsPage() {
  const { getAIVoicesForStage } = useVoices();
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<'base' | 'custom'>('base');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedVoices, setSelectedVoices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get AI voices for Stage 2
  const currentVoices = currentProject
    ? getAIVoicesForStage(currentProject.id, 'stage2').filter(voice => voice.type === activeTab)
    : [];

  const handlePlay = (voiceId: string, audioData: string) => {
    if (playingId === voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioData;
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          alert('Failed to play audio. Please try again.');
        });
        setPlayingId(voiceId);
      }
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoices(prev => {
      if (prev.includes(voiceId)) {
        return prev.filter(id => id !== voiceId);
      } else {
        return [...prev, voiceId];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedVoices.length === 0) {
      alert('Please select at least one voice');
      return;
    }

    if (!currentProject) {
      alert('Please select a project first');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the selected voices data
      const selectedVoicesList = currentVoices.filter(voice => selectedVoices.includes(voice.id));
      console.log('Selected AI voices to upload:', selectedVoicesList);
      
      // Upload each selected voice
      for (const voice of selectedVoicesList) {
        try {
          console.log('Processing AI voice:', voice.title);
          
          // Convert base64 to blob
          const audioData = voice.audioData.split(',')[1]; // Remove the data URL prefix
          console.log('Audio data length:', audioData.length);
          
          const byteCharacters = atob(audioData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/mp3' });
          console.log('Created blob:', blob.size, 'bytes');

          // Create a File object
          const fileName = `${voice.title.replace(/\s+/g, '_')}.mp3`;
          const file = new File([blob], fileName, { type: 'audio/mp3' });
          console.log('Created file:', fileName, file.size, 'bytes');

          // Create FormData and append the file
          const formData = new FormData();
          formData.append('file', file);
          formData.append('projectName', currentProject.name);
          formData.append('folderName', 'AI-voices'); // Specify the folder name for AI voices

          console.log('Uploading file:', fileName, 'to project:', currentProject.name, 'in folder: AI-voices');
          
          // Upload the voice file
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const responseData = await response.json();
          console.log('Upload response:', responseData);

          if (!response.ok) {
            throw new Error(`Failed to upload voice: ${voice.title}. Server response: ${JSON.stringify(responseData)}`);
          }
        } catch (voiceError) {
          console.error('Error processing voice:', voice.title, voiceError);
          throw voiceError;
        }
      }
      
      alert('AI voice selections uploaded successfully!');
      setSelectedVoices([]);
    } catch (error) {
      console.error('Error processing voice selections:', error);
      alert(`Failed to process voice selections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">AI Powered Versions</h1>
        
        {currentProject ? (
          <p className="mb-4 text-gray-700">Selecting AI voices for: <span className="font-semibold">{currentProject.name}</span></p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        {!currentProject ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Please select a project first to view available AI voices.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex space-x-1 p-1 bg-gray-100 rounded-lg max-w-xs">
                <button
                  onClick={() => setActiveTab('base')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'base'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Base Voices
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'custom'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Custom Voices
                </button>
              </div>
            </div>

            {currentVoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {activeTab === 'base' 
                    ? 'No AI base voices available.' 
                    : 'No AI custom voices available for this project.'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {currentVoices.map((voice) => (
                    <div 
                      key={voice.id} 
                      className={`flex flex-col p-6 border rounded-lg transition-colors ${
                        selectedVoices.includes(voice.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold text-gray-900 truncate">{voice.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handlePlay(voice.id, voice.audioData)}
                            className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            {playingId === voice.id ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleVoiceSelect(voice.id)}
                            className={`p-2 rounded-full transition-colors ${
                              selectedVoices.includes(voice.id)
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d={selectedVoices.includes(voice.id)
                                  ? "M5 13l4 4L19 7"
                                  : "M12 4v16m8-8H4"
                                }
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm leading-relaxed mb-4 flex-grow line-clamp-3">{voice.description}</p>

                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {voice.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedVoices.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Uploading...' : 'Upload Selected Voices'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
} 