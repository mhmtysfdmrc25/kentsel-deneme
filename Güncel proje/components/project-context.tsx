'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Project } from '@/lib/projects';
import { savedCostTotal } from '@/lib/costs';

type State = { projects: Project[]; activeProject: Project | null; activeCostTotal: number | null; selectProject: (id: number | null) => void; refresh: () => Promise<void>; loading: boolean; error: string };
const Context = createContext<State | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    if (!response.ok) throw new Error('Projeler yüklenemedi.');
    const data: Project[] = await response.json();
    setProjects(data);
    setActiveId(current => current !== null && !data.some(project => project.id === current) ? null : current);
  }, []);
  useEffect(() => {
    const stored = Number(localStorage.getItem('activeProjectId'));
    if (Number.isSafeInteger(stored) && stored > 0) setActiveId(stored);
    setInitialized(true);
    refresh().catch(() => setError('Projeler yüklenemedi. Sayfayı yenileyin.')).finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    if (!initialized) return;
    if (activeId === null) localStorage.removeItem('activeProjectId');
    else localStorage.setItem('activeProjectId', String(activeId));
  }, [activeId, initialized]);
  const activeProject = projects.find(p => p.id === activeId) ?? null;
  const activeCostTotal = savedCostTotal(activeProject);
  return <Context.Provider value={{ projects, activeProject, activeCostTotal, selectProject: setActiveId, refresh, loading, error }}>{children}</Context.Provider>;
}
export function useProjects() {
  const context = useContext(Context);
  if (!context) throw new Error('ProjectProvider bulunamadı.');
  return context;
}
