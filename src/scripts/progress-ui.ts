import { loadProgress, getOverallProgress, getRankProgress, isModuleLocked } from './progress';

const RING_CIRCUMFERENCE = 263.9;

// Marks completed lessons with a checkmark (elements with data-lesson-id).
export function updateCompletionMarks(): void {
  const progress = loadProgress();
  document.querySelectorAll('[data-lesson-id]').forEach((el) => {
    const id = (el as HTMLElement).dataset.lessonId;
    if (id && progress.completedLessons.includes(id)) {
      el.querySelector('.completion-mark')?.classList.remove('hidden');
    }
  });
}

// Marks completed labs with a checkmark (elements with data-lab-id).
export function updateLabCompletionMarks(): void {
  const progress = loadProgress();
  document.querySelectorAll('[data-lab-id]').forEach((el) => {
    const id = (el as HTMLElement).dataset.labId;
    if (id && progress.completedLabs.includes(id)) {
      el.querySelector('.completion-mark')?.classList.remove('hidden');
    }
  });
}

// Fills module progress bars (elements with data-module-progress + data-lessons="a,b,c").
export function updateProgressBars(): void {
  const progress = loadProgress();
  document.querySelectorAll<HTMLElement>('[data-module-progress]').forEach((el) => {
    const ids = (el.dataset.lessons || '').split(',').filter(Boolean);
    const completed = ids.filter((id) => progress.completedLessons.includes(id)).length;
    const pct = ids.length ? Math.round((completed / ids.length) * 100) : 0;
    el.querySelectorAll<HTMLElement>('.progress-fill').forEach((fill) => {
      fill.style.width = `${pct}%`;
    });
    el.querySelectorAll<HTMLElement>('.progress-label').forEach((label) => {
      label.textContent = `${pct}%`;
    });
  });
}

// Rewrites a "Start/Continue" CTA to point at the first incomplete lesson.
export function updateModuleCta(): void {
  const progress = loadProgress();
  document.querySelectorAll<HTMLElement>('[data-module-cta]').forEach((cta) => {
    const ids = (cta.dataset.lessons || '').split(',').filter(Boolean);
    const firstIncomplete = ids.find((id) => !progress.completedLessons.includes(id));
    if (firstIncomplete) {
      const href = (cta.dataset.lessonsHref || '')
        .split(',')
        .map((h, i) => ({ id: ids[i], href: h }))
        .find((e) => e.id === firstIncomplete);
      if (href) {
        cta.setAttribute('href', href.href);
        cta.textContent = ids.indexOf(firstIncomplete) === 0 ? 'Start' : 'Continue';
      }
    } else {
      cta.textContent = '✓ Completed';
      cta.classList.add('btn-secondary');
      cta.classList.remove('btn-primary');
    }
  });
}

export function updateProgressUI(): void {
  updateCompletionMarks();
  updateLabCompletionMarks();
  updateProgressBars();
  updateModuleCta();
}

// Fills every `.progress-ring[data-overall-progress]` with real completion %.
export function updateOverallProgress(): void {
  const { pct } = getOverallProgress();
  document.querySelectorAll<HTMLElement>('[data-overall-progress]').forEach((ring) => {
    const fill = ring.querySelector<SVGCircleElement>('.progress-ring-fill');
    if (fill) {
      fill.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - pct / 100)}`;
    }
    const label = ring.querySelector<HTMLElement>('.progress-ring-label');
    if (label) label.textContent = `${pct}%`;
  });
}

// Fills rank progress-to-next-threshold bars (elements with data-rank-progress).
export function updateRankProgressUI(): void {
  const rankProgress = getRankProgress();
  document.querySelectorAll<HTMLElement>('[data-rank-progress]').forEach((el) => {
    const fill = el.querySelector<HTMLElement>('[data-rank-progress-fill]');
    if (fill) fill.style.width = `${rankProgress.pct}%`;
    const label = el.querySelector<HTMLElement>('[data-rank-progress-label]');
    if (label) {
      if (rankProgress.next) {
        const lessonWord = rankProgress.lessonsToNext === 1 ? 'lesson' : 'lessons';
        const labWord = rankProgress.labsToNext === 1 ? 'lab' : 'labs';
        label.textContent = `${rankProgress.lessonsToNext} ${lessonWord} + ${rankProgress.labsToNext} ${labWord} to ${rankProgress.next}`;
      } else {
        label.textContent = 'Max rank reached';
      }
    }
  });
}

// Soft-locks module links (elements with data-module-lock="<moduleId>") — adds a
// dimmed/badge visual only, never removes href or pointer-events.
export function updateModuleLockStates(): void {
  document.querySelectorAll<HTMLElement>('[data-module-lock]').forEach((el) => {
    const moduleId = el.dataset.moduleLock || '';
    const locked = moduleId ? isModuleLocked(moduleId) : false;
    el.classList.toggle('is-locked', locked);
    el.querySelectorAll<HTMLElement>('[data-lock-badge]').forEach((badge) => {
      badge.classList.toggle('hidden', !locked);
    });
  });
}

// Sets is-complete / is-current / is-locked on roadmap nodes (elements with
// data-roadmap-node="<moduleId>" + data-lessons="a,b,c") from real progress data.
export function updateRoadmapNodes(): void {
  const progress = loadProgress();
  document.querySelectorAll<HTMLElement>('[data-roadmap-node]').forEach((el) => {
    const moduleId = el.dataset.roadmapNode || '';
    const ids = (el.dataset.lessons || '').split(',').filter(Boolean);
    if (!ids.length) return;
    const completedCount = ids.filter((id) => progress.completedLessons.includes(id)).length;
    const isComplete = completedCount === ids.length;
    const isCurrent = ids.includes(progress.currentLesson) || (completedCount > 0 && !isComplete);
    const locked = !isComplete && !isCurrent && isModuleLocked(moduleId);
    el.classList.toggle('is-complete', isComplete);
    el.classList.toggle('is-current', !isComplete && isCurrent);
    el.classList.toggle('is-locked', locked);
  });
}

export function updateDashboardUI(): void {
  updateOverallProgress();
  updateRankProgressUI();
  updateModuleLockStates();
  updateRoadmapNodes();
}
