'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Project } from '@/lib/projects';
import { savedCostTotal } from '@/lib/costs';
import type { BuildingDesign, SimulatorScenario } from '@/lib/simulator';
import type { FinancialScenario } from '@/lib/financial';

type ArchitectureDraft = SimulatorScenario & { design: BuildingDesign };
type State = {
  projects: Project[]; activeProject: Project | null; activeCostTotal: number | null;
  activeArchitectureDraft: ArchitectureDraft | undefined; activeFinancialDraft: FinancialScenario | undefined;
  setArchitectureDraft: (id: number, draft: ArchitectureDraft) => void;
  clearArchitectureDraft: (id: number, expected: ArchitectureDraft) => void;
  setFinancialDraft: (id: number, draft: FinancialScenario) => void;
  selectProject: (id: number | null) => void; refresh: () => Promise<void>; loading: boolean; error: string;
};
const Context = createContext<State | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [architectureDrafts, setArchitectureDrafts] = useState<Record<number, ArchitectureDraft>>({});
  const [financialDrafts, setFinancialDrafts] = useState<Record<number, FinancialScenario>>({});
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
  const activeArchitectureDraft = activeProject ? architectureDrafts[activeProject.id] : undefined;
  const activeFinancialDraft = activeProject ? financialDrafts[activeProject.id] : undefined;
  const setArchitectureDraft = (id: number, draft: ArchitectureDraft) => setArchitectureDrafts(previous => ({ ...previous, [id]: draft }));
  const clearArchitectureDraft = (id: number, expected: ArchitectureDraft) => setArchitectureDrafts(previous => {
    if (previous[id] !== expected) return previous;
    const next = { ...previous };
    delete next[id];
    return next;
  });
  const setFinancialDraft = (id: number, draft: FinancialScenario) => setFinancialDrafts(previous => ({ ...previous, [id]: draft }));
  return <Context.Provider value={{
    projects, activeProject, activeCostTotal, activeArchitectureDraft, activeFinancialDraft,
    setArchitectureDraft, clearArchitectureDraft, setFinancialDraft, selectProject: setActiveId, refresh, loading, error,
  }}>{children}</Context.Provider>;
}
export function useProjects() {
  const context = useContext(Context);
  if (!context) throw new Error('ProjectProvider bulunamadı.');
  return context;
}
