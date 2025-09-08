'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import BriefModal from '@/components/BriefModal';

interface Checkpoint {
  id: number;
  text: string;
  completed: boolean;
}

export default function AuditioningBrief() {
  const { currentProject } = useProject();
  const [description, setDescription] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([
    { id: 1, text: '', completed: false },
    { id: 2, text: '', completed: false },
    { id: 3, text: '', completed: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState<Array<{ name: string; size: number; webUrl: string; mimeType?: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const handleAddCheckpoint = () => {
    const newId = Math.max(...checkpoints.map(cp => cp.id)) + 1;
    setCheckpoints(prevCheckpoints => [...prevCheckpoints, { id: newId, text: '', completed: false }]);
  };

  const handleCheckpointChange = (id: number, newText: string) => {
    setCheckpoints(checkpoints.map(cp => 
      cp.id === id ? { ...cp, text: newText } : cp
    ));
  };

  const handleRemoveCheckpoint = (id: number) => {
    if (checkpoints.length > 1) {
      setCheckpoints(checkpoints.filter(cp => cp.id !== id));
    }
  };

  const generateBriefText = () => {
    const validCheckpoints = checkpoints.filter(cp => cp.text.trim());
    const briefContent = [
      `Project: ${currentProject?.name || 'Untitled Project'}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '\nProject Description:',
      description,
      '\nCheckpoints:',
      ...validCheckpoints.map((cp, index) => `${index + 1}. ${cp.text}`),
    ].join('\n');

    return briefContent;
  };

  const refreshDocuments = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`);
      const data = await res.json();
      // Check both new stage-based structure and legacy structure
      if (data?.files?.['stage1_documents']) {
        setDocuments(data.files['stage1_documents']);
      } else if (data?.files?.documents) {
        setDocuments(data.files.documents);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const handleViewBrief = async (fileName: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/brief?projectId=${encodeURIComponent(currentProject.id)}&fileName=${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error('Failed to load brief');
      const { content } = await res.json();
      setModalTitle(fileName);
      setModalContent(content);
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to load brief:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!currentProject) {
        throw new Error('No project selected. Please select a project first.');
      }

      // Validate inputs
      if (!description.trim()) {
        throw new Error('Please provide a project description');
      }

      const validCheckpoints = checkpoints.filter(cp => cp.text.trim());
      if (validCheckpoints.length === 0) {
        throw new Error('Please add at least one checkpoint');
      }

      // Generate brief text
      const briefContent = generateBriefText();
      
      // Create a text file
      const briefFile = new File(
        [briefContent],
        `brief_${currentProject.name}_${new Date().toISOString().split('T')[0]}.txt`,
        { type: 'text/plain' }
      );

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', briefFile);
      formData.append('projectName', currentProject.name);
      formData.append('stage', 'stage1');

      // Upload the brief file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to save brief');
      }

      // Reset form on success and refresh documents
      setDescription('');
      setCheckpoints([{ id: 1, text: '', completed: false }]);
      await refreshDocuments();
      alert('Brief saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">Auditioning Brief</h1>

        {currentProject ? (
          <p className="mb-4 text-gray-700">Creating brief for project: <span className="font-semibold">{currentProject.name}</span></p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label htmlFor="description" className="block text-lg font-medium text-gray-700">
              Project Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe what you're looking for in detail..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-700">Checkpoints</h2>
              <button
                type="button"
                onClick={handleAddCheckpoint}
                className="px-4 py-2 text-sm bg-white text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Add Checkpoint
              </button>
            </div>

            <div className="space-y-3">
              {checkpoints.map((checkpoint, index) => (
                <div key={checkpoint.id} className="flex items-center gap-3">
                  <span className="text-gray-500 min-w-[24px]">{index + 1}.</span>
                  <input
                    type="text"
                    value={checkpoint.text}
                    onChange={(e) => handleCheckpointChange(checkpoint.id, e.target.value)}
                    className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter checkpoint description..."
                  />
                  {checkpoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCheckpoint(checkpoint.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !currentProject}
            className={`w-full py-3 px-8 rounded-lg font-medium text-base transition-all duration-200
              ${isSubmitting || !currentProject
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'} 
              text-white`}
          >
            {isSubmitting ? 'Saving...' : 'Submit Brief'}
          </button>
        </form>

        {/* Uploaded Documents */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Uploaded Documents</h2>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
              {documents.map((d) => (
                <li key={d.name} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 mr-4">
                    <a href={d.webUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline break-all">
                      {d.name}
                    </a>
                    <div className="text-xs text-gray-500">{(d.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                  <div className="flex gap-2">
                    {d.name.startsWith('brief_') && d.name.endsWith('.txt') && (
                      <button
                        onClick={() => handleViewBrief(d.name)}
                        className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      <BriefModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        content={modalContent}
        title={modalTitle}
      />
    </div>
  );
} 