import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LiveDiff, LiveDiffMetadataField } from '../utils/diffFormState';

const DEFAULT_CONTAINER = '.blocks-form';
const DEFAULT_BLOCK = '[data-rbd-draggable-id]';
const BLOCK_ID_ATTR = 'data-rbd-draggable-id';

const DEFAULT_META: Record<LiveDiffMetadataField, string> = {
  title: '.documentFirstHeading, [class*="documentFirstHeading"], .block.title [contenteditable]',
  description: '.documentDescription, [class*="documentDescription"], .block.description [contenteditable]',
  preview_image: '.metadata-preview-image, [data-field="preview_image"]',
  subjects: '.metadata-subjects, [data-field="subjects"]',
};

const TIMING = {
  flipDuration: 680,
  flipEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  fadeInDuration: 620,
  fadeOutDuration: 520,
  flashDuration: 1400,
  pulseHoldMs: 2200,
};

type IntensityMode = 'subtle' | 'full';
type ReducedMode = 'auto' | 'fade-only' | 'off';

type Snapshot = {
  rect: DOMRect;
  outerHTML: string;
  parentRect: DOMRect | null;
};

export type LiveAnimationsAPI = {
  captureBefore: () => void;
  applyDiff: (diff: LiveDiff, intensity?: IntensityMode) => void;
  markWorking: (blockIds: string[]) => void;
  clearWorking: (blockIds?: string[]) => void;
};

type Options = {
  containerSelector?: string;
  blockSelector?: string;
  metadataSelectors?: Partial<Record<LiveDiffMetadataField, string>>;
  reducedMotion?: ReducedMode;
};

const findContainer = (selector: string): Element | null => {
  if (typeof document === 'undefined') return null;
  return document.querySelector(selector);
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function useLiveLayoutAnimations(opts: Options = {}): LiveAnimationsAPI {
  const containerSelector = opts.containerSelector || DEFAULT_CONTAINER;
  const blockSelector = opts.blockSelector || DEFAULT_BLOCK;
  const reducedMode = opts.reducedMotion || 'fade-only';
  const metaSelectors = { ...DEFAULT_META, ...(opts.metadataSelectors || {}) };

  const snapshotsRef = useRef<Map<string, Snapshot>>(new Map());
  const pendingRef = useRef<{ diff: LiveDiff; intensity: IntensityMode } | null>(null);
  const workingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [tick, setTick] = useState(0);

  const captureBefore = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = findContainer(containerSelector);
    if (!container) return;
    const map = new Map<string, Snapshot>();
    const nodes = container.querySelectorAll(blockSelector) as NodeListOf<HTMLElement>;
    nodes.forEach((node) => {
      const id = node.getAttribute(BLOCK_ID_ATTR);
      if (!id) return;
      map.set(id, {
        rect: node.getBoundingClientRect(),
        outerHTML: node.outerHTML,
        parentRect: node.parentElement ? node.parentElement.getBoundingClientRect() : null,
      });
    });
    snapshotsRef.current = map;
  }, [containerSelector, blockSelector]);

  const applyDiff = useCallback((diff: LiveDiff, intensity: IntensityMode = 'full') => {
    pendingRef.current = { diff, intensity };
    setTick((t) => (t + 1) % 1_000_000);
  }, []);

  const findBlockNode = useCallback((id: string): HTMLElement | null => {
    if (typeof document === 'undefined' || !id) return null;
    try {
      return document.querySelector(`[${BLOCK_ID_ATTR}="${CSS.escape(id)}"]`) as HTMLElement | null;
    } catch {
      return null;
    }
  }, []);

  const markWorking = useCallback((blockIds: string[]) => {
    if (typeof document === 'undefined') return;
    blockIds.forEach((id) => {
      const node = findBlockNode(id);
      if (!node) return;
      node.classList.add('kyra-block--working');
      const existing = workingTimeoutsRef.current.get(id);
      if (existing) window.clearTimeout(existing);
      const handle = window.setTimeout(() => {
        const stillThere = findBlockNode(id);
        if (stillThere) stillThere.classList.remove('kyra-block--working');
        workingTimeoutsRef.current.delete(id);
      }, TIMING.pulseHoldMs);
      workingTimeoutsRef.current.set(id, handle);
    });
  }, [findBlockNode]);

  const clearWorking = useCallback((blockIds?: string[]) => {
    if (typeof document === 'undefined') return;
    if (!blockIds) {
      workingTimeoutsRef.current.forEach((h) => window.clearTimeout(h));
      workingTimeoutsRef.current.clear();
      document
        .querySelectorAll('.kyra-block--working')
        .forEach((el) => el.classList.remove('kyra-block--working'));
      return;
    }
    blockIds.forEach((id) => {
      const handle = workingTimeoutsRef.current.get(id);
      if (handle) {
        window.clearTimeout(handle);
        workingTimeoutsRef.current.delete(id);
      }
      const node = findBlockNode(id);
      if (node) node.classList.remove('kyra-block--working');
    });
  }, [findBlockNode]);

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending || typeof document === 'undefined') return;
    pendingRef.current = null;
    const { diff, intensity } = pending;

    const container = findContainer(containerSelector);
    if (!container) {
      snapshotsRef.current.clear();
      return;
    }

    const reduced = reducedMode === 'off' ? false : prefersReducedMotion();
    const fadeOnly = reduced && reducedMode !== 'off';
    const allowMotion = !fadeOnly && intensity === 'full';

    const findBlock = (id: string): HTMLElement | null => {
      try {
        return container.querySelector(`[${BLOCK_ID_ATTR}="${CSS.escape(id)}"]`) as HTMLElement | null;
      } catch {
        return null;
      }
    };

    if (allowMotion) {
      diff.moved.forEach((id) => {
        const before = snapshotsRef.current.get(id);
        const node = findBlock(id);
        if (!before || !node) return;
        const after = node.getBoundingClientRect();
        const dx = before.rect.left - after.left;
        const dy = before.rect.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        try {
          node.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: 'translate(0, 0)' },
            ],
            { duration: TIMING.flipDuration, easing: TIMING.flipEasing, fill: 'none' },
          );
        } catch (_) {}
      });
    }

    diff.added.forEach((id) => {
      const node = findBlock(id);
      if (!node) return;
      const fromTransform = allowMotion ? 'translateY(22px) scale(0.94)' : 'none';
      try {
        node.animate(
          [
            { opacity: 0, transform: fromTransform },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: TIMING.fadeInDuration, easing: TIMING.flipEasing, fill: 'none' },
        );
      } catch (_) {}
      node.classList.add('kyra-block--just-added');
      window.setTimeout(() => node.classList.remove('kyra-block--just-added'), TIMING.flashDuration);
    });

    if (intensity === 'full') {
      diff.removed.forEach((id) => {
        const snap = snapshotsRef.current.get(id);
        if (!snap) return;
        const ghost = document.createElement('div');
        ghost.innerHTML = snap.outerHTML;
        const el = ghost.firstElementChild as HTMLElement | null;
        if (!el) return;
        el.style.position = 'fixed';
        el.style.top = `${snap.rect.top}px`;
        el.style.left = `${snap.rect.left}px`;
        el.style.width = `${snap.rect.width}px`;
        el.style.height = `${snap.rect.height}px`;
        el.style.margin = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9998';
        el.classList.add('kyra-block--ghost');
        document.body.appendChild(el);
        const toTransform = allowMotion ? 'scale(0.9) translateY(-12px)' : 'none';
        try {
          const anim = el.animate(
            [
              { opacity: 1, transform: 'scale(1) translateY(0)' },
              { opacity: 0, transform: toTransform },
            ],
            { duration: TIMING.fadeOutDuration, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
          );
          anim.onfinish = () => el.remove();
          anim.oncancel = () => el.remove();
        } catch (_) {
          el.remove();
        }
      });
    }

    diff.textChanged.forEach((id) => {
      const node = findBlock(id);
      if (!node) return;
      node.classList.remove('kyra-block--flash');
      void (node as HTMLElement).offsetWidth;
      node.classList.add('kyra-block--flash');
      window.setTimeout(() => node.classList.remove('kyra-block--flash'), TIMING.flashDuration);
    });

    diff.metadataChanged.forEach((field) => {
      const sel = metaSelectors[field];
      if (!sel) return;
      const target = document.querySelector(sel);
      if (!target) return;
      target.classList.remove('kyra-meta--flash');
      void (target as HTMLElement).offsetWidth;
      target.classList.add('kyra-meta--flash');
      window.setTimeout(() => target.classList.remove('kyra-meta--flash'), TIMING.flashDuration);
    });

    snapshotsRef.current.clear();
  }, [tick, containerSelector, reducedMode, metaSelectors]);

  useEffect(() => {
    return () => {
      workingTimeoutsRef.current.forEach((h) => window.clearTimeout(h));
      workingTimeoutsRef.current.clear();
    };
  }, []);

  return { captureBefore, applyDiff, markWorking, clearWorking };
}
