import type { TINANBlueprint, TINANProject, ProjectStatus, TokenizationPlan } from '../core/tinan-blueprint';

const STORAGE_KEY = 'tinan-ai.projects.v1';

function isProject(value: unknown): value is TINANProject {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Partial<TINANProject>;
  return typeof project.id === 'string'
    && typeof project.title === 'string'
    && typeof project.idea === 'string'
    && typeof project.status === 'string'
    && typeof project.createdAt === 'string'
    && typeof project.updatedAt === 'string';
}

export function listProjects(): TINANProject[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProject) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: TINANProject[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    throw new Error('Projects could not be saved in this browser. Check available storage and try again.');
  }
}

export function saveProject(
  idea: string,
  blueprint?: TINANBlueprint,
  existingId?: string,
  tokenizationPlan?: TokenizationPlan,
): TINANProject {
  const projects = listProjects();
  const existing = existingId ? projects.find((project) => project.id === existingId) : undefined;
  const now = new Date().toISOString();
  const project: TINANProject = {
    id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}`,
    title: blueprint?.title ?? existing?.title ?? idea.trim().slice(0, 56) ?? 'Untitled project',
    idea: idea.trim(),
    status: blueprint ? 'READY' : existing?.status ?? 'DRAFT',
    blueprint: blueprint ?? existing?.blueprint,
    tokenizationPlan: tokenizationPlan ?? existing?.tokenizationPlan,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  saveProjects([project, ...projects.filter((item) => item.id !== project.id)]);
  return project;
}

export function updateProjectStatus(id: string, status: ProjectStatus): TINANProject | null {
  const projects = listProjects();
  const project = projects.find((item) => item.id === id);
  if (!project) return null;
  const updated = { ...project, status, updatedAt: new Date().toISOString() };
  saveProjects(projects.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function findProject(id: string): TINANProject | null {
  return listProjects().find((project) => project.id === id) ?? null;
}
