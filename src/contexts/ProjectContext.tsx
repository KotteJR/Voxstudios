'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface ProjectContextType {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string) => Promise<void>;
  loading: boolean;
  prefetch?: Record<string, any> | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefetch, setPrefetch] = useState<Record<string, any> | null>(null);
  const prefetchRef = React.useRef<Record<string, any> | null>(null);
  const refreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load projects from API
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects/list', { cache: 'no-store' });
        const data = await response.json();
        if (data.projects) {
          setProjects(data.projects);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };

    // Load current project from cookie
    const loadCurrentProject = () => {
      const storedProject = Cookies.get('selectedProject');
      if (storedProject) {
        try {
          const parsedProject = JSON.parse(storedProject);
          setCurrentProject(parsedProject);
        } catch (error) {
          console.error('Error parsing project data:', error);
          Cookies.remove('selectedProject');
        }
      }
    };

    loadProjects();
    loadCurrentProject();
    // Restore cached files if available for the selected project
    try {
      const storedProject = Cookies.get('selectedProject');
      if (storedProject) {
        const parsed = JSON.parse(storedProject);
        const cached = sessionStorage.getItem(`files_${parsed.id}`);
        if (cached) {
          prefetchRef.current = JSON.parse(cached);
          setPrefetch(prefetchRef.current);
          (window as any).__FILES_CACHE__ = prefetchRef.current;
        }
      }
    } catch {}
  }, []);

  // Update cookie when current project changes
  useEffect(() => {
    if (currentProject) {
      Cookies.set('selectedProject', JSON.stringify(currentProject), { expires: 7, path: '/', sameSite: 'lax' });
      // Preload all stage file lists for faster tab switching
      (async () => {
        try {
          // Kick off multiple fetches in parallel for better warm cache
          await Promise.all([
            fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`, { cache: 'no-store' })
          ]).then(async ([all]) => {
            const data = await all.json();
            prefetchRef.current = data?.files || {};
            setPrefetch(prefetchRef.current);
            try {
              // Persist to sessionStorage to survive soft navigations
              sessionStorage.setItem(`files_${currentProject.id}`, JSON.stringify(prefetchRef.current));
              (window as any).__FILES_CACHE__ = prefetchRef.current;
            } catch {}
          });
          // Set up background refresh every 60s
          if (refreshTimerRef.current) clearInterval(refreshTimerRef.current as any);
          refreshTimerRef.current = setInterval(async () => {
            try {
              const res = await fetch(`/api/projects/files?projectId=${encodeURIComponent(currentProject.id)}`, { cache: 'no-store' });
              const data = await res.json();
              prefetchRef.current = data?.files || {};
              setPrefetch(prefetchRef.current);
              try {
                sessionStorage.setItem(`files_${currentProject.id}`, JSON.stringify(prefetchRef.current));
                (window as any).__FILES_CACHE__ = prefetchRef.current;
              } catch {}
            } catch {}
          }, 60000);
        } catch (e) {
          console.error('Prefetch files failed:', e);
          setPrefetch(null);
        }
      })();
    } else {
      Cookies.remove('selectedProject');
      setPrefetch(null);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current as any);
    }
  }, [currentProject]);

  const createProject = async (name: string) => {
    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectName: name }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh full list to avoid duplicates and ensure source of truth
        try {
          const listRes = await fetch('/api/projects/list', { cache: 'no-store' });
          const listData: { projects?: Project[] } = await listRes.json();
          if (listData.projects) {
            // De-dupe by id
            const deduped: Project[] = Array.from(new Map(listData.projects.map((p: Project) => [p.id, p])).values());
            setProjects(deduped);
          } else {
            setProjects(prev => {
              const map = new Map<string, Project>(prev.map(p => [p.id, p]));
              map.set(data.project.id, data.project as Project);
              return Array.from(map.values());
            });
          }
        } catch {
          setProjects(prev => {
            const map = new Map<string, Project>(prev.map(p => [p.id, p]));
            map.set(data.project.id, data.project as Project);
            return Array.from(map.values());
          });
        }
        setCurrentProject(data.project);
      } else {
        throw new Error(data.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        setProjects,
        currentProject,
        setCurrentProject,
        createProject,
        loading,
        prefetch,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
} 