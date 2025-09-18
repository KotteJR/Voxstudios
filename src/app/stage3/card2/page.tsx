'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useVoices } from '@/contexts/VoiceContext';
import { useProject } from '@/contexts/ProjectContext';

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
}

export default function IteratedVoicesPage() {
  const { getAIVoicesForStage } = useVoices();
  const { currentProject, prefetch } = useProject();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [teamVoices, setTeamVoices] = useState<Voice[]>([]);

  // Get all available voices for the current project
  const contextVoices = currentProject ? getAIVoicesForStage(currentProject.id, 'stage3') : [];
  const currentVoices = [...contextVoices, ...teamVoices];

  useEffect(() => {
    const loadFromTeams = async () => {
      if (!currentProject) return setTeamVoices([]);
      try {
        let data: any = null;
        if (prefetch && (prefetch as any)['stage3_iteratedVoices']) {
          data = { files: prefetch };
        } else {
          const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`, { cache: 'no-store' });
          data = await res.json();
        }
        // Only voices uploaded by Admin for Stage 3 (iterated-voices)
        const iter = (data?.files?.['stage3_iteratedVoices'] || []) as Array<{ name: string; url?: string; webUrl: string }>;
        const mapped: Voice[] = iter.map(f => ({
          id: `teams-${f.name}`,
          title: f.name.replace(/\.[^/.]+$/, ''),
          description: 'Uploaded to Teams: stage3/iterated-voices',
          tags: [],
          audioUrl: f.url || f.webUrl,
          type: 'custom',
          uploadDate: new Date().toISOString(),
          projectId: currentProject.id,
          stageId: 'stage3',
        }));
        setTeamVoices(mapped);
      } catch (e) {
        console.error('Failed to load stage3 voices:', e);
        setTeamVoices([]);
      }
    };
    loadFromTeams();
  }, [currentProject, prefetch]);

  const handlePlay = (voiceId: string, audioUrl: string) => {
    if (playingId === voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          setPlayingId(null);
          alert('Failed to play audio. The file may need to be re-uploaded. Please try uploading the voice again from the admin panel.');
        });
        setPlayingId(voiceId);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">Iterated Voices</h1>
        
        {currentProject ? (
          <p className="mb-4 text-gray-700">Viewing iterated voices for: <span className="font-semibold">{currentProject.name}</span></p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        {!currentProject ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Please select a project first to view available voices.</p>
          </div>
        ) : (
          <>
            <div className="mb-6" />

            {currentVoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No iterated voices available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentVoices.map((voice) => (
                  <div 
                    key={voice.id} 
                    className="flex flex-col p-6 border rounded-lg border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-gray-900 truncate">{voice.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => voice.audioUrl && handlePlay(voice.id, voice.audioUrl)}
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
            )}
          </>
        )}

        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
} 