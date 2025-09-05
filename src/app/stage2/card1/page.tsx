'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';

interface ScriptLine {
  id: number;
  text: string;
  timestamp: string;
}

export default function ScriptUpload() {
  const { currentProject } = useProject();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Array<{ name: string; size: number; webUrl: string; mimeType?: string }>>([]);
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([
    { id: 1, text: '', timestamp: '00:00' },
    { id: 2, text: '', timestamp: '' },
    { id: 3, text: '', timestamp: '' },
    { id: 4, text: '', timestamp: '' },
    { id: 5, text: '', timestamp: '' },
    { id: 6, text: '', timestamp: '' },
  ]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file extension instead of MIME type for better compatibility
      const validExtensions = ['.txt', '.doc', '.docx', '.pdf', '.rtf'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (validExtensions.includes(fileExtension)) {
        setFile(selectedFile);
        setError(null);
        console.log('File selected:', selectedFile.name, 'Type:', selectedFile.type);
      } else {
        setError('Please select a text document file (TXT, DOC, DOCX, PDF, RTF)');
        setFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Check file extension instead of MIME type for better compatibility
      const validExtensions = ['.txt', '.doc', '.docx', '.pdf', '.rtf'];
      const fileExtension = droppedFile.name.substring(droppedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (validExtensions.includes(fileExtension)) {
        setFile(droppedFile);
        setError(null);
        console.log('File dropped:', droppedFile.name, 'Type:', droppedFile.type);
      } else {
        setError('Please select a text document file (TXT, DOC, DOCX, PDF, RTF)');
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
      
      alert('Script uploaded successfully!');
      await refreshDocuments();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload script. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const refreshDocuments = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`);
      const data = await res.json();
      if (data?.files?.documents) setDocuments(data.files.documents);
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const handleDelete = async (name: string) => {
    if (!currentProject) return;
    if (!confirm(`Remove ${name}?`)) return;
    try {
      const res = await fetch('/api/projects/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id, category: 'documents', name })
      });
      if (!res.ok) throw new Error('Delete failed');
      await refreshDocuments();
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete file');
    }
  };

  useEffect(() => {
    refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  const handleLineChange = (id: number, field: 'text' | 'timestamp', value: string) => {
    setScriptLines(prevLines =>
      prevLines.map(line =>
        line.id === id ? { ...line, [field]: value } : line
      )
    );
  };

  const handleAddLine = () => {
    const newId = Math.max(...scriptLines.map(line => line.id)) + 1;
    setScriptLines([...scriptLines, { id: newId, text: '', timestamp: '' }]);
  };

  const handleRemoveLine = (id: number) => {
    if (scriptLines.length > 1) {
      setScriptLines(scriptLines.filter(line => line.id !== id));
    }
  };

  const formatTimestamp = (value: string) => {
    // Remove non-numeric characters
    const numbers = value.replace(/[^\d]/g, '');
    
    if (numbers.length <= 2) {
      return numbers;
    }
    
    // Format as MM:SS
    const minutes = numbers.slice(0, 2);
    const seconds = numbers.slice(2, 4);
    return `${minutes}:${seconds}`;
  };

  const handleSubmit = async () => {
    if (!currentProject) {
      setError('No project selected. Please select a project first.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate script content
      const validLines = scriptLines.filter(line => line.text.trim());
      if (validLines.length === 0) {
        throw new Error('Please add at least one script line');
      }

      // Create script content with timestamps
      const scriptContent = validLines.map(line => 
        `[${line.timestamp || '00:00'}] ${line.text}`
      ).join('\n');

      // Add project info at the top
      const fullContent = [
        `Project: ${currentProject.name}`,
        `Date: ${new Date().toLocaleDateString()}`,
        `Script Review`,
        '',
        scriptContent
      ].join('\n');

      // Create a folder name based on the project and current date
      const folderName = `script_review_${currentProject.name}_${new Date().toISOString().split('T')[0]}`;

      // Create a text file
      const scriptFile = new File(
        [fullContent],
        `script_timestamps_${currentProject.name}_${new Date().toISOString().split('T')[0]}.txt`,
        { type: 'text/plain' }
      );

      // Create FormData and append the file and folder name
      const formData = new FormData();
      formData.append('file', scriptFile);
      formData.append('projectName', currentProject.name);
      formData.append('folderName', folderName);

      // Upload the script file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to save script');
      }

      // Reset form on success
      setScriptLines([
        { id: 1, text: '', timestamp: '00:00' },
        { id: 2, text: '', timestamp: '' },
        { id: 3, text: '', timestamp: '' },
        { id: 4, text: '', timestamp: '' },
        { id: 5, text: '', timestamp: '' },
        { id: 6, text: '', timestamp: '' },
      ]);
      
      alert('Script saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">Script Review</h1>
        
        {currentProject ? (
          <p className="mb-4 text-gray-700">Reviewing script for project: <span className="font-semibold">{currentProject.name}</span></p>
        ) : (
          <p className="mb-4 text-red-600">No project selected. Please select a project first.</p>
        )}

        {!currentProject ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Please select a project first to review scripts.</p>
          </div>
        ) : (
          <>
            {/* File Upload Section */}
            <div className="mb-12">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".txt,.doc,.docx,.pdf,.rtf"
                  className="hidden"
                  id="script-upload"
                />
                <label
                  htmlFor="script-upload"
                  className="block cursor-pointer"
                >
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-lg text-gray-700 mb-2">
                    {file ? file.name : 'Drag and drop your script here or click to browse'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: TXT, DOC, DOCX, PDF, RTF
                  </p>
                </label>
              </div>
              
              {/* Upload Button */}
              {file && (
                <div className="mt-4">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className={`w-full py-2 px-4 rounded-md font-medium text-sm transition-all duration-200
                      ${isUploading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'} 
                      text-white`}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Script'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Timestamp Editor Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Timestamp Editor (Optional)</h2>
                <button
                  onClick={handleAddLine}
                  className="inline-flex items-center px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Line
                </button>
              </div>

              <div className="space-y-3">
                {scriptLines.map((line, index) => (
                  <div key={line.id} className="flex items-center gap-3 group">
                    <div className="w-24">
                      <input
                        type="text"
                        value={line.timestamp}
                        onChange={(e) => handleLineChange(line.id, 'timestamp', formatTimestamp(e.target.value))}
                        placeholder="MM:SS"
                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={5}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={line.text}
                        onChange={(e) => handleLineChange(line.id, 'text', e.target.value)}
                        placeholder={`Enter sentence ${index + 1}`}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    {scriptLines.length > 1 && (
                      <button
                        onClick={() => handleRemoveLine(line.id)}
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

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-3 px-8 rounded-lg font-medium text-base transition-all duration-200
                ${isSubmitting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'} 
                text-white`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>

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
                      <button
                        onClick={() => handleDelete(d.name)}
                        className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 