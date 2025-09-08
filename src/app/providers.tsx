'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { VoiceProvider } from '@/contexts/VoiceContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <ProjectProvider>
          <VoiceProvider>{children}</VoiceProvider>
        </ProjectProvider>
      </AuthProvider>
    </SessionProvider>
  );
}





