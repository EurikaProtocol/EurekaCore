import type { TINANBlueprint, TINANProject, ProjectStatus, TokenizationPlan } from '../core/tinan-blueprint';

const STORAGE_KEY = 'tinan-ai.projects.v1';
const PROJECT_STATUSES = ['DRAFT', 'ANALYZING', 'READY', 'TOKENIZING', 'DEPLOYED', 'VERIFIED', 'LIVE'] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function isBlueprint(value: unknown): value is TINANBlueprint {
  if (typeof value !== 'object' || value === null) return false;
  const blueprint = value as Partial<TINANBlueprint>;
  return typeof blueprint.id === 'string'
    && typeof blueprint.title === 'string'
    && typeof blueprint.description === 'string'
    && typeof blueprint.category === 'string'
    && typeof blueprint.problem === 'string'
    && typeof blueprint.solution === 'string'
    && typeof blueprint.tokenizationModel === 'string'
    && typeof blueprint.tokenType === 'string'
    && typeof blueprint.blockchain === 'string'
    && typeof blueprint.utility === 'string'
    && isStringArray(blueprint.dataSources)
    && typeof blueprint.energyData === 'string'
    && typeof blueprint.proofModel === 'string'
    && isStringArray(blueprint.risks)
    && isStringArray(blueprint.complianceNotes)
    && typeof blueprint.readinessScore === 'number'
    && isStringArray(blueprint.recommendations)
    && typeof blueprint.createdAt === 'string';
}

function isProject(value: unknown): value is TINANProject {
  if (typeof value !== 'object' || value === null) return false;
  const project = value as Partial<TINANProject>;
  return typeof project.id === 'string'
    && typeof project.title === 'string'
    && typeof project.idea === 'string'
    && typeof project.status === 'string'
    && PROJECT_STATUSES.includes(project.status as (typeof PROJECT_STATUSES)[number])
    && typeof project.createdAt === 'string'
    && typeof project.updatedAt === 'string'
    && (project.blueprint === undefined || isBlueprint(project.blueprint));
}

export function listProjects(): TINANProject[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProject) : [];
  } catch {
    throw new Error('Saved projects could not be loaded from this browser.');
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
    title: blueprint?.title ?? existing?.title ?? (idea.trim().slice(0, 56) || 'Untitled project'),
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
