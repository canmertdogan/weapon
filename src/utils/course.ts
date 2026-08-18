import { getCollection, type CollectionEntry } from 'astro:content';
import { MODULES } from '../data/modules';
import { BASE } from './base';

export type LessonEntry = CollectionEntry<'lessons'>;

export interface LessonNode {
  id: string;
  module: string;
  title: string;
  order: number;
  objectives: string[];
  interactive: string;
  lab: string;
  duration: number;
  slug: string;
  href: string;
}

export interface ModuleNode {
  id: string;
  label: string;
  order: number;
  summary: string;
  locked: boolean;
  lessons: LessonNode[];
}

export async function getLessons(): Promise<LessonEntry[]> {
  return getCollection('lessons');
}

export async function getModuleTree(): Promise<ModuleNode[]> {
  const lessons = await getLessons();
  const byModule = new Map<string, LessonEntry[]>();
  for (const lesson of lessons) {
    const m = lesson.data.module;
    if (!byModule.has(m)) byModule.set(m, []);
    byModule.get(m)!.push(lesson);
  }

  return MODULES.map((meta) => {
    const entries = (byModule.get(meta.id) || []).sort((a, b) => a.data.order - b.data.order);
    const nodes: LessonNode[] = entries.map((e) => ({
      id: e.data.id,
      module: e.data.module,
      title: e.data.title,
      order: e.data.order,
      objectives: e.data.objectives,
      interactive: e.data.interactive,
      lab: e.data.lab,
      duration: e.data.duration,
      slug: e.data.id,
      href: `${BASE}course/${e.data.module}/${e.data.id}`,
    }));
    return {
      id: meta.id,
      label: meta.label,
      order: meta.order,
      summary: meta.summary,
      locked: meta.locked,
      lessons: nodes,
    };
  });
}

export async function getLessonByModuleAndId(module: string, id: string): Promise<{ entry: LessonEntry; node: LessonNode } | null> {
  const lessons = await getLessons();
  const entry = lessons.find((l) => l.data.module === module && l.data.id === id);
  if (!entry) return null;
  return {
    entry,
    node: {
      id: entry.data.id,
      module: entry.data.module,
      title: entry.data.title,
      order: entry.data.order,
      objectives: entry.data.objectives,
      interactive: entry.data.interactive,
      lab: entry.data.lab,
      duration: entry.data.duration,
      slug: entry.data.id,
      href: `${BASE}course/${entry.data.module}/${entry.data.id}`,
    },
  };
}

export async function getAdjacentLessons(module: string, id: string): Promise<{ prev: LessonNode | null; next: LessonNode | null }> {
  const tree = await getModuleTree();
  const flat: LessonNode[] = [];
  for (const m of tree) {
    for (const l of m.lessons) flat.push(l);
  }
  const idx = flat.findIndex((l) => l.module === module && l.id === id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export async function getModuleProgressSummary(): Promise<{ total: number; byModule: Record<string, { total: number }> }> {
  const tree = await getModuleTree();
  const byModule: Record<string, { total: number }> = {};
  let total = 0;
  for (const m of tree) {
    byModule[m.id] = { total: m.lessons.length };
    total += m.lessons.length;
  }
  return { total, byModule };
}
