'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';

type StepStatus = 'pending' | 'approved' | 'disapproved' | 'in_progress';

interface Step {
  title: string;
  description: string;
  component: string;
  status: StepStatus;
}

interface Stage {
  id: number;
  title: string;
  description: string;
  href: string;
  status: StepStatus;
  steps: Step[];
}

const initialStages: Stage[] = [
  {
    id: 1,
    title: 'Stage 1: Original Video Campaign',
    description: 'Upload and process the original video',
    href: '/stage1/dashboard',
    status: 'in_progress',
    steps: [
      {
        title: 'Original Video Campaign',
        description: 'Upload and manage your original video content',
        component: 'VideoUpload',
        status: 'in_progress'
      },
      {
        title: 'Auditioning Brief',
        description: 'Create and review the auditioning requirements',
        component: 'AuditioningBrief',
        status: 'pending'
      },
      {
        title: 'Voice Selection',
        description: 'Listen to and manage voice auditions',
        component: 'VoiceSelection',
        status: 'pending'
      }
    ]
  },
  {
    id: 2,
    title: 'Stage 2: Script & Timestamps',
    description: 'Define script and set timestamps',
    href: '/stage2/dashboard',
    status: 'pending',
    steps: [
      {
        title: 'Script Upload',
        description: 'Upload and manage your script',
        component: 'ScriptUpload',
        status: 'pending'
      },
      {
        title: 'Timestamp Editor',
        description: 'Set and edit timestamps for your script',
        component: 'TimestampEditor',
        status: 'pending'
      }
    ]
  },
  {
    id: 3,
    title: 'Stage 3: Voice Selection',
    description: 'Review and select voice options',
    href: '/stage3/dashboard',
    status: 'pending',
    steps: [
      {
        title: 'Base Voice Selection',
        description: 'Choose your preferred base voice',
        component: 'BaseVoiceSelection',
        status: 'pending'
      },
      {
        title: 'Custom Voice Selection',
        description: 'Review and select custom voice options',
        component: 'CustomVoiceSelection',
        status: 'pending'
      }
    ]
  },
  {
    id: 4,
    title: 'Stage 4: Final Review',
    description: 'Choose and approve the final voice',
    href: '/stage4/dashboard',
    status: 'pending',
    steps: [
      {
        title: 'Final Voice Review',
        description: 'Review and approve the final voice output',
        component: 'FinalVoiceReview',
        status: 'pending'
      }
    ]
  }
];

export default function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentProject } = useProject();
  const projectId = currentProject?.id || searchParams?.get('project');
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [expandedStages, setExpandedStages] = useState<number[]>([]);
  const [filesByCategory, setFilesByCategory] = useState<Record<string, { name: string; size: number; webUrl: string; mimeType?: string }[]>>({ videos: [], voices: [], documents: [] });

  const toggleStage = (stageId: number) => {
    setExpandedStages(prev => 
      prev.includes(stageId) 
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId]
    );
  };

  const calculateStageStatus = (steps: Step[]): StepStatus => {
    if (steps.some(step => step.status === 'disapproved')) return 'disapproved';
    if (steps.every(step => step.status === 'approved')) return 'approved';
    if (steps.some(step => step.status === 'in_progress')) return 'in_progress';
    return 'pending';
  };

  const calculateProgress = (steps: Step[]): number => {
    const completed = steps.filter(step => step.status === 'approved').length;
    return Math.round((completed / steps.length) * 100);
  };

  const updateStepStatus = (stageId: number, stepIndex: number, newStatus: StepStatus) => {
    setStages(prevStages => {
      const newStages = [...prevStages];
      const stage = { ...newStages[stageId - 1] };
      stage.steps = [...stage.steps];
      stage.steps[stepIndex] = { ...stage.steps[stepIndex], status: newStatus };
      newStages[stageId - 1] = stage;

      // Persist to Teams status.json
      if (projectId) {
        fetch(`/api/projects/status?projectId=${encodeURIComponent(projectId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stages: newStages }),
        }).catch((e) => console.error('Failed to save status:', e));
      }

      return newStages;
    });
  };

  // Load stages from Teams status.json
  useEffect(() => {
    if (!projectId) {
      router.push('/projects');
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/status?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        if (data?.stages) setStages(data.stages);
      } catch (e) {
        console.error('Failed to load status:', e);
      }
    };
    load();
  }, [projectId, router]);

  // Load uploaded files per category from Teams
  useEffect(() => {
    if (!projectId) return;
    const loadFiles = async () => {
      try {
        const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        if (data?.files) setFilesByCategory(data.files);
      } catch (e) {
        console.error('Failed to load files:', e);
      }
    };
    loadFiles();
  }, [projectId]);

  const getStatusStyle = (status: StepStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'disapproved':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
          <p className="mt-2 text-lg text-gray-600">Track your project progress and approve completed stages</p>
        </div>

        <div className="space-y-4">
          {stages.map((stage) => {
            const stageStatus = calculateStageStatus(stage.steps);
            const progress = calculateProgress(stage.steps);
            
            return (
              <div key={stage.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleStage(stage.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-semibold text-gray-900">{stage.title}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-gray-600">{stage.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{progress}% Complete</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              stageStatus === 'disapproved' ? 'bg-red-500' : 
                              stageStatus === 'approved' ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(stageStatus)}`}>
                      {stageStatus.charAt(0).toUpperCase() + stageStatus.slice(1)}
                    </span>
                    {expandedStages.includes(stage.id) ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedStages.includes(stage.id) && (
                  <div className="border-t border-gray-200">
                    <div className="divide-y divide-gray-200">
                      {stage.steps.map((step, index) => (
                        <div key={index} className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-gray-900">{step.title}</h3>
                              <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                              {/* Uploaded assets indicator */}
                              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                {step.component === 'VideoUpload' && (
                                  <div className="px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700">
                                    {filesByCategory.videos.length > 0 ? `${filesByCategory.videos.length} video(s) uploaded` : 'No videos yet'}
                                  </div>
                                )}
                                {step.component?.toLowerCase().includes('voice') && (
                                  <div className="px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700">
                                    {filesByCategory.voices.length > 0 ? `${filesByCategory.voices.length} audio file(s) uploaded` : 'No audio yet'}
                                  </div>
                                )}
                                {step.component?.toLowerCase().includes('script') && (
                                  <div className="px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700">
                                    {filesByCategory.documents.length > 0 ? `${filesByCategory.documents.length} document(s) uploaded` : 'No documents yet'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(step.status)}`}>
                                {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateStepStatus(stage.id, index, 'approved')}
                                  className={`p-1.5 rounded-full hover:bg-green-50 ${
                                    step.status === 'approved' ? 'text-green-600' : 'text-gray-400'
                                  }`}
                                >
                                  <CheckCircleIcon className="w-6 h-6" />
                                </button>
                                <button
                                  onClick={() => updateStepStatus(stage.id, index, 'disapproved')}
                                  className={`p-1.5 rounded-full hover:bg-red-50 ${
                                    step.status === 'disapproved' ? 'text-red-600' : 'text-gray-400'
                                  }`}
                                >
                                  <XCircleIcon className="w-6 h-6" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 