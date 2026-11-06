import {
  PINNED_CARD_HEIGHT_PX, PINNED_ROW_GAP_PX, PINNED_SCROLL_PAD_PX, PINNED_VISIBLE_ROWS,
  isScrollable, pinnedAreaMaxHeight, revealDelta, visibleWithin,
} from './pinnedScroll';

test('the Pinned area is capped at exactly two card rows plus the inner ring padding', () => {
  expect(PINNED_VISIBLE_ROWS).toBe(2);
  expect(PINNED_CARD_HEIGHT_PX).toEqual({ default: 80, popup: 92 });
  expect(PINNED_ROW_GAP_PX).toBe(8);
  expect(PINNED_SCROLL_PAD_PX).toBe(4);
  // 2 * 80 + 8 (one row gap) + 2 * 4 (inner padding top/bottom)
  expect(pinnedAreaMaxHeight(false)).toBe(176);
  expect(pinnedAreaMaxHeight(true)).toBe(200);
});

test('scroll indication only applies when content is taller than the two-row cap', () => {
  expect(isScrollable(176, 176)).toBe(false); // exactly two rows
  expect(isScrollable(92, 176)).toBe(false); // one row: no max-height effect
  expect(isScrollable(176.4, 176)).toBe(false); // sub-pixel rounding is not a third row
  expect(isScrollable(264, 176)).toBe(true); // third row
});

test('revealDelta scrolls just enough to show the whole card with its focus ring', () => {
  const area = { top: 100, bottom: 276 };
  expect(revealDelta(area, { top: 104, bottom: 184 })).toBe(0); // first row
  expect(revealDelta(area, { top: 192, bottom: 272 })).toBe(0); // second row
  expect(revealDelta(area, { top: 280, bottom: 360 })).toBe(88); // third row → down
  expect(revealDelta(area, { top: 20, bottom: 100 })).toBe(-84); // above → up
});

test('visibleWithin is false once the anchor has fully left the clip area', () => {
  const area = { top: 100, bottom: 276 };
  expect(visibleWithin(area, { top: 110, bottom: 134 })).toBe(true);
  expect(visibleWithin(area, { top: 270, bottom: 294 })).toBe(true); // partially visible
  expect(visibleWithin(area, { top: 276, bottom: 300 })).toBe(false);
  expect(visibleWithin(area, { top: 60, bottom: 100 })).toBe(false);
});
