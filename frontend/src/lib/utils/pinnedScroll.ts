/**
 * Pinned area layout: at most two card rows are visible; further rows scroll inside the area.
 * Card heights are fixed per variant, so two rows have the same height at every breakpoint even
 * though the number of cards per row changes with the width (flex-wrap, no count cap).
 */
export const PINNED_VISIBLE_ROWS = 2;
/** Pinned card height (px) — `default` page / `popup` (extension side panel). */
export const PINNED_CARD_HEIGHT_PX = { default: 80, popup: 92 } as const;
/** Row gap of the card list (Tailwind gap-2). */
export const PINNED_ROW_GAP_PX = 8;
/** Inner padding (Tailwind p-1, offset by -m-1) so focus rings/shadows are not clipped by the scroll edge. */
export const PINNED_SCROLL_PAD_PX = 4;

export function pinnedCardHeight(popup: boolean) {
  return popup ? PINNED_CARD_HEIGHT_PX.popup : PINNED_CARD_HEIGHT_PX.default;
}

/** Scroll container max-height: two rows + one row gap + inner padding (top and bottom). */
export function pinnedAreaMaxHeight(popup: boolean) {
  return PINNED_VISIBLE_ROWS * pinnedCardHeight(popup) + (PINNED_VISIBLE_ROWS - 1) * PINNED_ROW_GAP_PX
    + 2 * PINNED_SCROLL_PAD_PX;
}

/** A third row exists only when content is taller than the visible box (ignores sub-pixel rounding). */
export function isScrollable(scrollHeight: number, clientHeight: number) {
  return scrollHeight - clientHeight > 1;
}

type Span = { top: number; bottom: number };

/** Vertical scroll delta that brings `item` (plus ring padding) fully inside `area`; 0 if already visible. */
export function revealDelta(area: Span, item: Span, pad = PINNED_SCROLL_PAD_PX) {
  if (item.top - pad < area.top) return item.top - pad - area.top;
  if (item.bottom + pad > area.bottom) return item.bottom + pad - area.bottom;
  return 0;
}

/** True while at least part of `item` is inside the visible `area`. */
export function visibleWithin(area: Span, item: Span) {
  return item.bottom > area.top && item.top < area.bottom;
}
