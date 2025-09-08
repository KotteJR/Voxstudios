'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Voice {
  id: string;
  title: string;
  description: string;
  tags: string[];
  audioUrl?: string; // URL to the uploaded audio file on SharePoint
  type: 'base' | 'custom';
  uploadDate: string;
  projectId?: string;
  stageId?: string;
  isAIVoice?: boolean;
  feedback?: Feedback[];
}

interface Feedback {
  id: string;
  timestamp: number;
  comment: string;
  resolved: boolean;
}

interface VoiceContextType {
  voices: Voice[];
  addVoice: (voice: Omit<Voice, 'id' | 'uploadDate'>) => Promise<void>;
  deleteVoice: (id: string) => void;
  getVoicesForProject: (projectId: string) => Voice[];
  getBaseVoices: () => Voice[];
  getAIVoicesForStage: (projectId: string, stageId: string) => Voice[];
  clearOldVoices: () => void;
  getStorageInfo: () => { used: number; available: number; percentage: number };
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// Storage utility functions
const getStorageSize = (): number => {
  if (typeof window === 'undefined') return 0;
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
};

const getStorageQuota = (): number => {
  // Most browsers have a 5-10MB limit for localStorage
  return 5 * 1024 * 1024; // 5MB in bytes
};

const safeSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded');
      return false;
    }
    throw error;
  }
};

const cleanupOldVoices = (voices: Voice[]): Voice[] => {
  // Keep only the 10 most recent voices to prevent storage overflow
  return voices
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, 10);
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [voices, setVoices] = useState<Voice[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedVoices = localStorage.getItem('voices');
        return savedVoices ? JSON.parse(savedVoices) : [];
      } catch (error) {
        console.error('Error loading voices from localStorage:', error);
        return [];
      }
    }
    return [];
  });

  // Save voices to localStorage with error handling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const voicesJson = JSON.stringify(voices);
      const success = safeSetItem('voices', voicesJson);
      
      if (!success) {
        // If storage is full, try to clean up old voices
        console.warn('Storage quota exceeded, cleaning up old voices...');
        const cleanedVoices = cleanupOldVoices(voices);
        const cleanedJson = JSON.stringify(cleanedVoices);
        const retrySuccess = safeSetItem('voices', cleanedJson);
        
        if (retrySuccess) {
          setVoices(cleanedVoices);
        } else {
          console.error('Unable to save voices even after cleanup');
        }
      }
    } catch (error) {
      console.error('Error saving voices to localStorage:', error);
    }
  }, [voices]);

  const addVoice = async (voiceData: Omit<Voice, 'id' | 'uploadDate'>) => {
    const newVoice: Voice = {
      ...voiceData,
      id: Date.now().toString(),
      uploadDate: new Date().toISOString(),
    };

    setVoices(prev => {
      const updated = [...prev, newVoice];
      
      // Check if we're approaching storage limit
      const voicesJson = JSON.stringify(updated);
      const currentSize = getStorageSize();
      const quota = getStorageQuota();
      
      if (currentSize + voicesJson.length > quota * 0.8) { // 80% threshold
        console.warn('Approaching storage limit, cleaning up old voices...');
        return cleanupOldVoices(updated);
      }
      
      return updated;
    });
  };

  const deleteVoice = (id: string) => {
    setVoices(prev => prev.filter(voice => voice.id !== id));
  };

  const clearOldVoices = () => {
    setVoices(prev => cleanupOldVoices(prev));
  };

  const getStorageInfo = () => {
    const used = getStorageSize();
    const available = getStorageQuota();
    const percentage = (used / available) * 100;
    
    return { used, available, percentage };
  };

  const getVoicesForProject = (projectId: string) => {
    return voices.filter(voice => 
      voice.projectId === projectId && !voice.isAIVoice
    );
  };

  const getAIVoicesForStage = (projectId: string, stageId: string) => {
    return voices.filter(voice => 
      voice.projectId === projectId && 
      voice.isAIVoice && 
      voice.stageId === stageId
    );
  };

  const getBaseVoices = () => {
    // Return base voices
    return voices.filter(voice => voice.type === 'base');
  };

  return (
    <VoiceContext.Provider value={{ 
      voices, 
      addVoice, 
      deleteVoice, 
      getVoicesForProject, 
      getAIVoicesForStage, 
      getBaseVoices,
      clearOldVoices,
      getStorageInfo
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoices() {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoices must be used within a VoiceProvider');
  }
  return context;
} 