import type { AstroIntegration, HookParameters } from 'astro';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import { z } from 'astro/zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const lessonSchema = z.object({
  id: z.string().min(1),
  module: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().positive(),
  objectives: z.array(z.string().min(1)).min(1),
  interactive: z.string().optional().default(''),
  lab: z.string().optional().default(''),
  duration: z.number().int().positive(),
});

interface ValidationError {
  file: string;
  errors: z.ZodIssue[];
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return load(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function loadLessons(): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const contentDir = join(__dirname, '..', 'content');
  const lessons: { id: string; data: Record<string, unknown> }[] = [];

  async function walk(dir: string, prefix = ''): Promise<void> {
    const entries = await import('fs').then(fs => fs.promises.readdir(dir, { withFileTypes: true }));
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = join(prefix, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (entry.name.endsWith('.md')) {
        const id = relPath.replace(/\.md$/, '');
        const content = await readFile(fullPath, 'utf-8');
        const data = parseFrontmatter(content);
        if (data) {
          lessons.push({ id, data });
        }
      }
    }
  }

  await walk(contentDir);
  return lessons;
}

export function validateLessonsIntegration(): AstroIntegration {
  return {
    name: 'validate-lessons',
    hooks: {
      'astro:build:start': async ({ logger }: HookParameters<'astro:build:start'>) => {
        logger.info('Validating lesson content...');
      },
      'astro:build:done': async ({ logger }: HookParameters<'astro:build:done'>) => {
        const lessons = await loadLessons();
        const allErrors: ValidationError[] = [];
        const seenIds = new Map<string, string>();
        const seenModules = new Set<string>();

        for (const lesson of lessons) {
          const filePath = lesson.id;
          const result = lessonSchema.safeParse(lesson.data);

          if (!result.success) {
            allErrors.push({ file: filePath, errors: result.error.issues });
            continue;
          }

          const data = result.data;

          // Check for duplicate IDs
          if (seenIds.has(data.id)) {
            allErrors.push({
              file: filePath,
              errors: [{ code: 'custom', message: `Duplicate lesson ID: ${data.id} (also in ${seenIds.get(data.id)})`, path: ['id'] }],
            });
          } else {
            seenIds.set(data.id, filePath);
          }

          seenModules.add(data.module);
        }

        // Check for missing module IDs in MODULES
        try {
          const moduleFile = await import('../data/modules.ts');
          const validModuleIds = moduleFile.MODULES.map((m: { id: string }) => m.id);
          for (const moduleId of seenModules) {
            if (!validModuleIds.includes(moduleId)) {
              logger.warn(`Lesson references unknown module: ${moduleId}`);
            }
          }
        } catch {}

        if (allErrors.length > 0) {
          let errorMsg = 'Lesson validation failed:\n';
          for (const err of allErrors) {
            errorMsg += `\n${err.file}:\n`;
            for (const issue of err.errors) {
              errorMsg += `  - ${issue.path.join('.')}: ${issue.message}\n`;
            }
          }
          logger.error(errorMsg);
          throw new Error('Lesson validation failed');
        }

        logger.info(`Validated ${lessons.length} lessons successfully`);
      },
    },
  };
}

export default validateLessonsIntegration;