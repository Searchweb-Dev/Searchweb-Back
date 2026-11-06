'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent, type RefObject } from 'react';
import { isScrollable, revealDelta } from '@/lib/utils/pinnedScroll';

/**
 * Two-row Pinned scroll area helpers for the element in `areaRef`.
 * - `data-scrollable` mirrors whether a third row exists (written to the DOM directly: no re-render).
 * - Returns a focus handler: keyboard focus on a card outside the visible rows scrolls the area so
 *   the whole card and its focus ring are visible. Skipped while the card is moving (FLIP owns that scroll).
 */
export function usePinnedScrollArea(areaRef: RefObject<HTMLDivElement | null>) {
  const observed = useRef<{ element: HTMLElement; observer: ResizeObserver | null; measure: () => void } | null>(null);

  // Runs after every commit: card count/width changes arrive with React commits, and the area
  // itself mounts/unmounts with the empty/loading states.
  useLayoutEffect(() => {
    const element = areaRef.current;
    if (observed.current?.element !== element) {
      if (observed.current) {
        observed.current.observer?.disconnect();
        window.removeEventListener('resize', observed.current.measure);
        observed.current = null;
      }
      if (element) {
        const measure = () => {
          element.dataset.scrollable = String(isScrollable(element.scrollHeight, element.clientHeight));
        };
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
        observer?.observe(element);
        if (element.firstElementChild) observer?.observe(element.firstElementChild);
        window.addEventListener('resize', measure);
        observed.current = { element, observer, measure };
      }
    }
    observed.current?.measure();
  });

  useEffect(() => () => {
    if (!observed.current) return;
    observed.current.observer?.disconnect();
    window.removeEventListener('resize', observed.current.measure);
    observed.current = null;
  }, []);

  return useCallback((event: FocusEvent<HTMLDivElement>) => {
    const area = event.currentTarget;
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-flip-id]');
    if (!card || !area.contains(card)) return;
    if (typeof card.getAnimations === 'function' && card.getAnimations().length > 0) return;
    const delta = revealDelta(area.getBoundingClientRect(), card.getBoundingClientRect());
    if (delta !== 0) area.scrollTop += delta;
  }, []);
}
