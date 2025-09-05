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
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load projects from API
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects/list');
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
  }, []);

  // Update cookie when current project changes
  useEffect(() => {
    if (currentProject) {
      Cookies.set('selectedProject', JSON.stringify(currentProject), { expires: 7, path: '/', sameSite: 'lax' });
    } else {
      Cookies.remove('selectedProject');
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
        setProjects(prev => [...prev, data.project]);
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