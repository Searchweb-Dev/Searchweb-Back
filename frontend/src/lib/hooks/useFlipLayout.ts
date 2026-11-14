'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { revealDelta } from '@/lib/utils/pinnedScroll';

/** Confirmed v8 motion, slowed slightly per user decision (v8 used 260ms). */
export const PIN_MOVE_DURATION_MS = 320;
/** Same deceleration curve as v8. */
export const PIN_MOVE_EASING = 'cubic-bezier(.2,.8,.2,1)';

export type FlipBox = { x: number; y: number; w: number; h: number };
type Snapshot = Map<string, FlipBox & { list: string }>;

const round = (value: number) => String(Number(value.toFixed(4)));

/** FLIP "invert" frames: transform/opacity only — never top/left interpolation. */
export function flipKeyframes(from: FlipBox, to: FlipBox): Keyframe[] | null {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const sx = to.w ? from.w / to.w : 1;
  const sy = to.h ? from.h / to.h : 1;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return null;
  return [
    { transform: `translate(${round(dx)}px, ${round(dy)}px) scale(${round(sx)}, ${round(sy)})`, transformOrigin: '0 0' },
    { transform: 'none', transformOrigin: '0 0' },
  ];
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Activation blocker for a moving root: only clicks / Enter / Space aimed at non-editable targets
 * inside `root` are cancelled. Typing in the search field and controls outside the root
 * (dialogs, toasts) keep working while cards travel.
 */
const makeSwallow = (root: HTMLElement) => (event: Event) => {
  const target = event.target;
  if (!(target instanceof Element) || !root.contains(target) || target.closest(EDITABLE)) return;
  if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

/** Nearest clipping scroll area (`data-flip-clip`, e.g. the two-row Pinned list) inside the root. */
function clipOf(node: HTMLElement, root: HTMLElement) {
  const clip = node.parentElement?.closest<HTMLElement>('[data-flip-clip]') ?? null;
  return clip && root.contains(clip) ? clip : null;
}

/** Inert, unclipped visual copy positioned (fixed) at the destination slot; no duplicate a11y nodes. */
function makeGhost(node: HTMLElement, box: { x: number; y: number; w: number; h: number }) {
  const ghost = node.cloneNode(true) as HTMLElement;
  for (const el of [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]) {
    for (const name of Array.from(el.attributes).map(attr => attr.name)) {
      if (name === 'id' || name === 'role' || name === 'tabindex' || name.startsWith('aria-') || name.startsWith('data-')) el.removeAttribute(name);
    }
  }
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.setAttribute('data-flip-ghost', '');
  Object.assign(ghost.style, {
    position: 'fixed', left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`,
    margin: '0', boxSizing: 'border-box', pointerEvents: 'none', zIndex: '50',
  });
  document.body.appendChild(ghost);
  return ghost;
}

/**
 * Animates `[data-flip-id]` children of `rootRef` whenever their list membership/order changes.
 * A folder keeps its `data-flip-id` across lists, so Pin/Unpin travels between the two lists while
 * remaining cards slide into the freed slot. Positions are root-relative so scrolling is ignored.
 */
export function useFlipLayout(rootRef: RefObject<HTMLElement | null>) {
  const snapshot = useRef<Snapshot>(new Map());
  const layoutKey = useRef<string | null>(null);
  const running = useRef(new Map<HTMLElement, Animation>());
  const generation = useRef(0);

  const stopBlocking = useRef<(() => void) | null>(null);
  const ghosts = useRef(new Map<HTMLElement, HTMLElement>());
  const removeGhosts = () => {
    ghosts.current.forEach(ghost => ghost.remove());
    ghosts.current.clear();
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'));
    const key = nodes.map(node => `${node.dataset.flipList}:${node.dataset.flipId}`).join('|');
    const origin = root.getBoundingClientRect();
    const boxOf = (rect: DOMRect): FlipBox => ({ x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height });

    if (key === layoutKey.current) {
      // Same lists: only refresh resting positions (never while a move is in flight).
      if (running.current.size === 0) {
        snapshot.current = new Map(nodes.map(node => [node.dataset.flipId!, { ...boxOf(node.getBoundingClientRect()), list: node.dataset.flipList ?? '' }]));
      }
      return;
    }
    const first = layoutKey.current === null || layoutKey.current === '';
    layoutKey.current = key;
    const reduced = prefersReducedMotion();
    const canAnimate = !first && !reduced && typeof root.animate === 'function';

    // Visual (possibly mid-flight) boxes, then cancel so the new layout can be measured.
    const visual = new Map<HTMLElement, DOMRect>();
    for (const node of nodes) visual.set(node, (ghosts.current.get(node) ?? node).getBoundingClientRect());
    running.current.forEach(animation => animation.cancel());
    const wasRunning = new Set(running.current.keys());
    running.current.clear();
    removeGhosts();

    const previous = snapshot.current;
    const next: Snapshot = new Map();
    const animations: Animation[] = [];
    let movedId: string | null = null;
    // A card that moved into a clipping scroll area (Pinned, max two rows) is revealed by scrolling
    // that area; the delta is applied after measuring so destinations are the post-scroll slots.
    const scrolls = new Map<HTMLElement, number>();
    for (const node of nodes) {
      const id = node.dataset.flipId!;
      const list = node.dataset.flipList ?? '';
      const resting = boxOf(node.getBoundingClientRect());
      next.set(id, { ...resting, list });
      const old = previous.get(id);
      if (!old || old.list === list) continue;
      movedId = id;
      const clip = clipOf(node, root);
      if (clip && !first && !scrolls.has(clip)) {
        const area = clip.getBoundingClientRect();
        const delta = revealDelta(area, { top: resting.y + origin.top, bottom: resting.y + origin.top + resting.h });
        if (delta !== 0) scrolls.set(clip, delta);
      }
    }
    for (const node of nodes) {
      const id = node.dataset.flipId!;
      const { list, ...resting } = next.get(id)!;
      const old = previous.get(id);
      if (!old || !canAnimate) continue;
      // Continue from where an interrupted move currently is rather than jumping.
      const seen = visual.get(node)!;
      const from = wasRunning.has(node)
        ? { x: old.x + (seen.left - origin.left - resting.x), y: old.y + (seen.top - origin.top - resting.y), w: old.w * (resting.w ? seen.width / resting.w : 1), h: old.h * (resting.h ? seen.height / resting.h : 1) }
        : old;
      const clip = old.list !== list ? clipOf(node, root) : null;
      if (clip) {
        // The scroll area would clip a card arriving from outside, so an unclipped, inert ghost makes
        // the trip to the (post-scroll) slot while the real card stays invisible but focusable.
        const to = { ...resting, y: resting.y - (scrolls.get(clip) ?? 0) };
        const ghost = makeGhost(node, { x: to.x + origin.left, y: to.y + origin.top, w: to.w, h: to.h });
        const frames = flipKeyframes(from, to) ?? [{ transform: 'none' }, { transform: 'none' }];
        const travel = ghost.animate(frames, { duration: PIN_MOVE_DURATION_MS, easing: PIN_MOVE_EASING });
        const hidden = node.animate([{ opacity: 0 }, { opacity: 0 }], { duration: PIN_MOVE_DURATION_MS });
        ghosts.current.set(node, ghost);
        running.current.set(node, hidden);
        running.current.set(ghost, travel);
        animations.push(travel, hidden);
        continue;
      }
      const frames = flipKeyframes(from, resting);
      if (!frames) continue;
      const animation = node.animate(frames, { duration: PIN_MOVE_DURATION_MS, easing: PIN_MOVE_EASING });
      running.current.set(node, animation);
      animations.push(animation);
    }
    snapshot.current = next;
    scrolls.forEach((delta, clip) => {
      const top = clip.scrollTop + delta;
      if (canAnimate && typeof clip.scrollTo === 'function') clip.scrollTo({ top, behavior: 'smooth' });
      else clip.scrollTop = top;
      // Resting boxes inside the scrolled area move up by the scrolled amount.
      next.forEach((box, id) => {
        const node = nodes.find(candidate => candidate.dataset.flipId === id);
        if (node && clipOf(node, root) === clip) box.y -= delta;
      });
    });

    const restoreFocus = () => {
      if (!movedId) return;
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      const card = root.querySelector<HTMLElement>(`[data-flip-id="${movedId.replace(/["\\]/g, '\\$&')}"]`);
      card?.querySelector<HTMLElement>('[data-folder-menu-trigger]')?.focus({ preventScroll: true });
    };

    if (animations.length === 0) {
      restoreFocus();
      return;
    }
    // Block clicks/activation while cards travel so rapid Pin/Unpin cannot interleave moves.
    if (!stopBlocking.current) {
      const swallow = makeSwallow(root);
      document.addEventListener('click', swallow, true);
      document.addEventListener('keydown', swallow, true);
      stopBlocking.current = () => {
        document.removeEventListener('click', swallow, true);
        document.removeEventListener('keydown', swallow, true);
        stopBlocking.current = null;
      };
    }
    restoreFocus();
    const current = ++generation.current;
    Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(() => {
      if (current !== generation.current) return;
      running.current.clear();
      removeGhosts();
      stopBlocking.current?.();
      snapshot.current = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'))
        .map(node => [node.dataset.flipId!, { ...boxOf(node.getBoundingClientRect()), list: node.dataset.flipList ?? '' }]));
    });
  });

  // Resting positions also change without a React commit (resize, panel width transitions).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const refresh = () => {
      if (running.current.size > 0) return;
      const origin = root.getBoundingClientRect();
      snapshot.current = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]')).map(node => {
        const rect = node.getBoundingClientRect();
        return [node.dataset.flipId!, { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height, list: node.dataset.flipList ?? '' }];
      }));
    };
    window.addEventListener('resize', refresh);
    // Scrolling the Pinned area moves its cards relative to the root: keep Unpin starting points current.
    root.addEventListener('scroll', refresh, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    observer?.observe(root);
    const runningAnimations = running.current;
    const liveGhosts = ghosts.current;
    return () => {
      window.removeEventListener('resize', refresh);
      root.removeEventListener('scroll', refresh, true);
      observer?.disconnect();
      runningAnimations.forEach(animation => animation.cancel());
      liveGhosts.forEach(ghost => ghost.remove());
      liveGhosts.clear();
      stopBlocking.current?.();
    };
  }, [rootRef]);
}
