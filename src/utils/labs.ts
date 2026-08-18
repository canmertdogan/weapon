import type { LabManifest } from '../types/lab';

const manifests = import.meta.glob('../content/labs/*/manifest.json', { eager: true });

export function getAllLabs(): LabManifest[] {
  const labs: LabManifest[] = [];
  for (const path in manifests) {
    const data = (manifests[path] as { default: LabManifest }).default;
    if (data && data.id) labs.push(data);
  }
  labs.sort((a, b) => a.id.localeCompare(b.id));
  return labs;
}

export function getLabById(id: string): LabManifest | undefined {
  return getAllLabs().find((l) => l.id === id);
}
