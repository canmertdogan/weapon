import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content' }),
  schema: z.object({
    id: z.string(),
    module: z.string(),
    title: z.string(),
    order: z.number(),
    objectives: z.array(z.string()),
    interactive: z.string().optional().default(''),
    lab: z.string().optional().default(''),
    duration: z.number(),
  }),
});

export const collections = { lessons };
