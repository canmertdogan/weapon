import { MODULES } from '../data/modules';

export interface ProgressData {
  version: number;
  completedLessons: string[];
  completedLabs: string[];
  currentLesson: string;
  rank: Rank;
}

export type Rank = 'RECRUIT' | 'ANALYST' | 'RESEARCHER' | 'REVERSE ENGINEER' | 'BINARY HUNTER';

const STORAGE_KEY = 'weapon:progress';
const CURRENT_VERSION = 1;

const RANK_THRESHOLDS: Record<Rank, { lessons: number; labs: number }> = {
  'RECRUIT': { lessons: 0, labs: 0 },
  'ANALYST': { lessons: 3, labs: 1 },
  'RESEARCHER': { lessons: 8, labs: 2 },
  'REVERSE ENGINEER': { lessons: 15, labs: 3 },
  'BINARY HUNTER': { lessons: 25, labs: 5 },
};

const RANK_ORDER: Rank[] = ['RECRUIT', 'ANALYST', 'RESEARCHER', 'REVERSE ENGINEER', 'BINARY HUNTER'];

// Single source of truth for module order + per-module lesson ids.
export const MODULE_ORDER: string[] = MODULES.map((m) => m.id);

export const MODULE_LESSONS: Record<string, string[]> = {
  start: ['s1', 's2', 's3'],
  foundations: ['f1', 'f2', 'f3', 'f4'],
  assembly: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
  'static-analysis': ['sa1', 'sa2', 'sa3', 'sa4', 'sa5'],
  debugging: ['d1', 'd2', 'd3', 'd4'],
  'exploit-dev': ['e1', 'e2', 'e3', 'e4', 'e5'],
  windows: ['w1', 'w2', 'w3', 'w4', 'w5'],
  linux: ['l1', 'l2', 'l3', 'l4', 'l5'],
  'arm-mobile': ['arm1', 'arm2', 'arm3', 'arm4'],
  malware: ['m1', 'm2', 'm3', 'm4', 'm5'],
  'anti-re': ['ar1', 'ar2', 'ar3', 'ar4'],
  final: ['u1'],
};

function getDefaultProgress(): ProgressData {
  return {
    version: CURRENT_VERSION,
    completedLessons: [],
    completedLabs: [],
    currentLesson: 's1',
    rank: 'RECRUIT',
  };
}

export function loadProgress(): ProgressData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultProgress();
    const parsed = JSON.parse(stored);
    if (parsed.version !== CURRENT_VERSION) {
      return migrateProgress(parsed);
    }
    return { ...getDefaultProgress(), ...parsed };
  } catch {
    return getDefaultProgress();
  }
}

function migrateProgress(old: Partial<ProgressData>): ProgressData {
  const def = getDefaultProgress();
  return {
    ...def,
    ...old,
    version: CURRENT_VERSION,
  };
}

export function saveProgress(progress: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent('weapon:progress', { detail: progress }));
  } catch (e) {
    console.warn('Failed to save progress:', e);
  }
}

export function markLessonComplete(lessonId: string): ProgressData {
  const progress = loadProgress();
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    progress.rank = calculateRank(progress);
  }
  progress.currentLesson = getNextLesson(lessonId) || lessonId;
  saveProgress(progress);
  return progress;
}

export function markLabComplete(labId: string): ProgressData {
  const progress = loadProgress();
  if (!progress.completedLabs.includes(labId)) {
    progress.completedLabs.push(labId);
    progress.rank = calculateRank(progress);
  }
  saveProgress(progress);
  return progress;
}

export function setCurrentLesson(lessonId: string): ProgressData {
  const progress = loadProgress();
  progress.currentLesson = lessonId;
  saveProgress(progress);
  return progress;
}

export function calculateRank(progress: ProgressData): Rank {
  const lessonCount = progress.completedLessons.length;
  const labCount = progress.completedLabs.length;

  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    const rank = RANK_ORDER[i];
    const threshold = RANK_THRESHOLDS[rank];
    if (lessonCount >= threshold.lessons && labCount >= threshold.labs) {
      return rank;
    }
  }
  return 'RECRUIT';
}

function getNextLesson(currentId: string): string | null {
  let found = false;
  for (const moduleId of MODULE_ORDER) {
    const lessons = MODULE_LESSONS[moduleId] || [];
    for (const lessonId of lessons) {
      if (found) return lessonId;
      if (lessonId === currentId) found = true;
    }
  }
  return null;
}

export function getModuleProgress(moduleId: string, totalLessons: number): number {
  const progress = loadProgress();
  const moduleLessons = MODULE_LESSONS[moduleId] || [];
  const completed = moduleLessons.filter((l) => progress.completedLessons.includes(l)).length;
  return totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
}

export function isModuleLocked(moduleId: string, moduleOrder: string[] = MODULE_ORDER): boolean {
  const progress = loadProgress();
  const currentIndex = moduleOrder.indexOf(moduleId);
  if (currentIndex <= 0) return false;
  const prevModule = moduleOrder[currentIndex - 1];
  const prevModuleLessons = MODULE_LESSONS[prevModule] || [];
  return prevModuleLessons.some((l) => !progress.completedLessons.includes(l));
}

export function updateRankBadge(): void {
  const progress = loadProgress();
  const badge = document.getElementById('rank-badge');
  if (badge) {
    badge.textContent = progress.rank;
  }
}

// Overall completion across every real lesson id known to the app.
export function getOverallProgress(): { completed: number; total: number; pct: number } {
  const progress = loadProgress();
  const allLessons = Object.values(MODULE_LESSONS).flat();
  const completed = allLessons.filter((l) => progress.completedLessons.includes(l)).length;
  const total = allLessons.length;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  lessonsToNext: number;
  labsToNext: number;
  pct: number;
}

// How close the learner is to the next rank threshold.
export function getRankProgress(): RankProgress {
  const progress = loadProgress();
  const currentIndex = RANK_ORDER.indexOf(progress.rank);
  const next = currentIndex < RANK_ORDER.length - 1 ? RANK_ORDER[currentIndex + 1] : null;

  if (!next) {
    return { current: progress.rank, next: null, lessonsToNext: 0, labsToNext: 0, pct: 100 };
  }

  const threshold = RANK_THRESHOLDS[next];
  const lessonsToNext = Math.max(0, threshold.lessons - progress.completedLessons.length);
  const labsToNext = Math.max(0, threshold.labs - progress.completedLabs.length);

  const lessonPct = threshold.lessons > 0 ? Math.min(1, progress.completedLessons.length / threshold.lessons) : 1;
  const labPct = threshold.labs > 0 ? Math.min(1, progress.completedLabs.length / threshold.labs) : 1;
  const pct = Math.round(Math.min(lessonPct, labPct) * 100);

  return { current: progress.rank, next, lessonsToNext, labsToNext, pct };
}

// Configurable rank thresholds - can be overridden by user settings
export function getRankThresholds(): Record<Rank, { lessons: number; labs: number }> {
  try {
    const stored = localStorage.getItem('weapon:rank-thresholds');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return RANK_THRESHOLDS;
}

export function setRankThresholds(thresholds: Record<Rank, { lessons: number; labs: number }>): void {
  try {
    localStorage.setItem('weapon:rank-thresholds', JSON.stringify(thresholds));
  } catch (e) {
    console.warn('Failed to save rank thresholds:', e);
  }
}

export function exportProgressData(): string {
  const progress = loadProgress();
  return JSON.stringify({
    version: CURRENT_VERSION,
    timestamp: Date.now(),
    progress,
  }, null, 2);
}

export function importProgressData(json: string): ProgressData | null {
  try {
    const data = JSON.parse(json);
    if (!data.version || !data.progress) {
      throw new Error('Invalid progress export format');
    }
    const imported = data.progress as ProgressData;
    if (imported.version !== CURRENT_VERSION) {
      return migrateProgress(imported);
    }
    saveProgress(imported);
    return imported;
  } catch (e) {
    console.error('Failed to import progress:', e);
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', updateRankBadge);
  window.addEventListener('weapon:progress', updateRankBadge);
}
