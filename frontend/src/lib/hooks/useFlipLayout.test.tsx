import React, { useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { PIN_MOVE_DURATION_MS, PIN_MOVE_EASING, flipKeyframes, useFlipLayout } from './useFlipLayout';

type Item = { id: string; list: 'P' | 'MF' };
// Deterministic layout: P cards on row y=0 (120px wide), MF cards on row y=200 (200px wide).
function layout(el: Element): DOMRect {
  const node = el as HTMLElement;
  if (node.dataset.flipRoot !== undefined) return { left: 0, top: 0, width: 1000, height: 400, right: 1000, bottom: 400, x: 0, y: 0, toJSON() {} } as DOMRect;
  const list = node.dataset.flipList;
  const index = Array.from(node.parentElement!.children).indexOf(node);
  const width = list === 'P' ? 120 : 200;
  const left = index * (width + 10);
  const top = list === 'P' ? 0 : 200;
  return { left, top, width, height: 80, right: left + width, bottom: top + 80, x: left, y: top, toJSON() {} } as DOMRect;
}

function Lists({ items, onClick }: { items: Item[]; onClick?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useFlipLayout(root);
  return <div ref={root} data-flip-root="">
    <div>{items.filter(i => i.list === 'P').map(i => <div key={i.id} data-flip-id={i.id} data-flip-list="P"><button type="button" data-folder-menu-trigger="">{i.id}</button></div>)}</div>
    <div>{items.filter(i => i.list === 'MF').map(i => <div key={i.id} data-flip-id={i.id} data-flip-list="MF"><button type="button" onClick={onClick}>{`open ${i.id}`}</button></div>)}</div>
  </div>;
}

const finishers: Array<() => void> = [];
const finish = () => finishers.splice(0).forEach(resolve => resolve());
const animate = jest.fn();
let reduced = false;
beforeEach(() => {
  reduced = false;
  animate.mockReset();
  animate.mockImplementation(() => {
    const finished = new Promise<void>(resolve => { finishers.push(resolve); });
    return { finished, cancel: jest.fn() };
  });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: animate });
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) { return layout(this); });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes('reduce'), media: query,
    addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn() }));
});
afterEach(() => { jest.restoreAllMocks(); delete (Element.prototype as { animate?: unknown }).animate; });

const before: Item[] = [{ id: 'a', list: 'MF' }, { id: 'b', list: 'MF' }, { id: 'c', list: 'MF' }];
const pinnedB: Item[] = [{ id: 'b', list: 'P' }, { id: 'a', list: 'MF' }, { id: 'c', list: 'MF' }];

test('flipKeyframes inverts the old box into the new one with transform only (no top/left)', () => {
  const frames = flipKeyframes({ x: 210, y: 200, w: 200, h: 80 }, { x: 0, y: 0, w: 120, h: 80 })!;
  expect(frames).toEqual([
    { transform: 'translate(210px, 200px) scale(1.6667, 1)', transformOrigin: '0 0' },
    { transform: 'none', transformOrigin: '0 0' },
  ]);
  for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(['transform', 'transformOrigin']);
  expect(flipKeyframes({ x: 5, y: 5, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBeNull();
});

test('Pin moves the card up into Pinned and the remaining cards close the gap, 320ms with the v8 easing', () => {
  const { rerender } = render(<Lists items={before} />);
  expect(animate).not.toHaveBeenCalled();
  rerender(<Lists items={pinnedB} />);
  const calls = animate.mock.calls.map(([frames, options], i) => ({ id: (animate.mock.contexts[i] as HTMLElement).dataset.flipId, frames, options }));
  expect(calls.map(c => c.id).sort()).toEqual(['b', 'c']);
  const moved = calls.find(c => c.id === 'b')!;
  // b was at MF index1 (x=210,y=200); now P index0 (x=0,y=0): starts below, travels upward.
  expect(moved.frames[0].transform).toBe('translate(210px, 200px) scale(1.6667, 1)');
  const filler = calls.find(c => c.id === 'c')!;
  expect(filler.frames[0].transform).toBe('translate(210px, 0px) scale(1, 1)');
  for (const c of calls) expect(c.options).toEqual({ duration: PIN_MOVE_DURATION_MS, easing: PIN_MOVE_EASING });
  expect(PIN_MOVE_DURATION_MS).toBe(320);
  expect(PIN_MOVE_EASING).toBe('cubic-bezier(.2,.8,.2,1)');
});

test('Unpin moves the card down back to its My Folder slot', () => {
  const { rerender } = render(<Lists items={pinnedB} />);
  rerender(<Lists items={before} />);
  const index = animate.mock.contexts.findIndex(el => (el as HTMLElement).dataset.flipId === 'b');
  expect(animate.mock.calls[index][0][0].transform).toBe('translate(-210px, -200px) scale(0.6, 1)');
});

test('prefers-reduced-motion applies the change immediately without animation', () => {
  reduced = true;
  const { rerender } = render(<Lists items={before} />);
  rerender(<Lists items={pinnedB} />);
  expect(animate).not.toHaveBeenCalled();
});

test('clicks are swallowed while cards are moving and work again after the move finishes', async () => {
  const onClick = jest.fn();
  const { rerender, getByText } = render(<Lists items={before} onClick={onClick} />);
  rerender(<Lists items={pinnedB} onClick={onClick} />);
  fireEvent.click(getByText('open a'));
  expect(onClick).not.toHaveBeenCalled();
  await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });
  fireEvent.click(getByText('open a'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('blocking is limited to non-editable targets inside the animated root', async () => {
  const outside = jest.fn();
  const typed = jest.fn();
  function WithControls({ items }: { items: Item[] }) {
    const root = useRef<HTMLDivElement>(null);
    useFlipLayout(root);
    return <>
      <div ref={root} data-flip-root="">
        <input aria-label="search" onKeyDown={event => typed(event.key)} />
        <div>{items.filter(i => i.list === 'P').map(i => <div key={i.id} data-flip-id={i.id} data-flip-list="P"><button type="button">{i.id}</button></div>)}</div>
        <div>{items.filter(i => i.list === 'MF').map(i => <div key={i.id} data-flip-id={i.id} data-flip-list="MF"><button type="button">{`open ${i.id}`}</button></div>)}</div>
      </div>
      <button type="button" onClick={outside}>outside</button>
    </>;
  }
  const { rerender, getByText, getByLabelText } = render(<WithControls items={before} />);
  rerender(<WithControls items={pinnedB} />);
  // Cards inside the root are still blocked while moving.
  expect(fireEvent.keyDown(getByText('open a'), { key: 'Enter' })).toBe(false);
  // Controls outside the root (dialogs, toasts) and editable fields inside it keep working.
  fireEvent.click(getByText('outside'));
  expect(outside).toHaveBeenCalledTimes(1);
  expect(fireEvent.keyDown(getByLabelText('search'), { key: ' ' })).toBe(true);
  expect(typed).toHaveBeenCalledWith(' ');
  await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });
});

// ── Pinned scroll area (max two rows, clipped) ──────────────────────────────
// P cards wrap two per row inside a clip box (top 0..176, inner pad 4, rows of 80 + gap 8).
// MF cards sit on a row at y=300. The clip's scrollTop shifts P cards upward.
function clipLayout(el: Element): DOMRect {
  const node = el as HTMLElement;
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
  if (node.dataset.flipRoot !== undefined) return rect(0, 0, 1000, 500);
  if (node.dataset.flipClip !== undefined) return rect(0, 0, 400, 176);
  if (node.dataset.flipList === 'P') {
    const clip = node.closest<HTMLElement>('[data-flip-clip]')!;
    const index = Array.from(node.parentElement!.children).indexOf(node);
    return rect(4 + (index % 2) * 200, 4 + Math.floor(index / 2) * 88 - clip.scrollTop, 196, 80);
  }
  if (node.dataset.flipList === 'MF') {
    const index = Array.from(node.parentElement!.children).indexOf(node);
    return rect(index * 210, 300, 200, 80);
  }
  return rect(0, 0, 0, 0);
}

function ClipLists({ items }: { items: Item[] }) {
  const root = useRef<HTMLDivElement>(null);
  useFlipLayout(root);
  return <div ref={root} data-flip-root="">
    <div data-flip-clip="" data-testid="clip"><div>{items.filter(i => i.list === 'P').map(i =>
      <div key={i.id} data-flip-id={i.id} data-flip-list="P"><button type="button" aria-label={`Open folder ${i.id}`}>{i.id}</button></div>)}</div></div>
    <div>{items.filter(i => i.list === 'MF').map(i => <div key={i.id} data-flip-id={i.id} data-flip-list="MF"><button type="button">{i.id}</button></div>)}</div>
  </div>;
}

const fourPinned: Item[] = ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, list: 'P' as const }));
const withX: Item[] = [...fourPinned, { id: 'x', list: 'MF' }, { id: 'y', list: 'MF' }];
const xPinned: Item[] = [...fourPinned, { id: 'x', list: 'P' }, { id: 'y', list: 'MF' }];
const scrollTo = jest.fn(function (this: HTMLElement, options: ScrollToOptions) { this.scrollTop = options.top ?? 0; });

describe('Pinned scroll area', () => {
  beforeEach(() => {
    (Element.prototype.getBoundingClientRect as jest.Mock).mockImplementation(function (this: Element) { return clipLayout(this); });
    scrollTo.mockClear();
    Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
  });
  afterEach(() => {
    delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
    document.querySelectorAll('[data-flip-ghost]').forEach(ghost => ghost.remove());
  });

  test('Pin into the third row smoothly scrolls the Pinned area to the new card while it moves up', () => {
    const { rerender, getByTestId } = render(<ClipLists items={withX} />);
    rerender(<ClipLists items={xPinned} />);
    // x lands at index 4 → row 3 (top 180, bottom 260): scroll by 260 + 4 - 176 = 88.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.contexts[0]).toBe(getByTestId('clip'));
    expect(scrollTo.mock.calls[0][0]).toEqual({ top: 88, behavior: 'smooth' });
  });

  test('the moving card travels as an unclipped ghost to its post-scroll slot; the real card stays hidden until it lands', async () => {
    const { rerender } = render(<ClipLists items={withX} />);
    rerender(<ClipLists items={xPinned} />);
    const ghost = document.querySelector<HTMLElement>('[data-flip-ghost]')!;
    expect(ghost).not.toBeNull();
    expect(ghost.parentElement).toBe(document.body);
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    // No duplicate accessible card while moving (single exposure).
    expect(ghost.querySelector('[aria-label]')).toBeNull();
    expect(ghost.style.position).toBe('fixed');
    expect(ghost.style.pointerEvents).toBe('none');
    // Destination = visible slot after scrolling: top 180 - 88 = 92.
    expect([ghost.style.left, ghost.style.top, ghost.style.width, ghost.style.height]).toEqual(['4px', '92px', '196px', '80px']);
    const ghostCall = animate.mock.contexts.indexOf(ghost);
    // From the My Folder slot (x=0, y=300, 200 wide) upward.
    expect(animate.mock.calls[ghostCall][0][0].transform).toBe('translate(-4px, 208px) scale(1.0204, 1)');
    expect(animate.mock.calls[ghostCall][1]).toEqual({ duration: PIN_MOVE_DURATION_MS, easing: PIN_MOVE_EASING });
    const real = document.querySelector<HTMLElement>('[data-flip-list="P"][data-flip-id="x"]')!;
    const realCall = animate.mock.contexts.indexOf(real);
    expect(animate.mock.calls[realCall][0]).toEqual([{ opacity: 0 }, { opacity: 0 }]);
    await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });
    expect(document.querySelector('[data-flip-ghost]')).toBeNull();
  });

  test('Pin into a visible row does not scroll the area', () => {
    const three: Item[] = [{ id: 'p1', list: 'P' }, { id: 'x', list: 'MF' }];
    const threePinned: Item[] = [{ id: 'p1', list: 'P' }, { id: 'x', list: 'P' }];
    const { rerender } = render(<ClipLists items={three} />);
    rerender(<ClipLists items={threePinned} />);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('reduced motion scrolls instantly and creates no ghost or animation', () => {
    reduced = true;
    const { rerender, getByTestId } = render(<ClipLists items={withX} />);
    rerender(<ClipLists items={xPinned} />);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(getByTestId('clip').scrollTop).toBe(88);
    expect(document.querySelector('[data-flip-ghost]')).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  test('Unpin from a scrolled area starts from where the card currently is (scroll offset tracked)', () => {
    const { rerender, getByTestId } = render(<ClipLists items={xPinned} />);
    const clip = getByTestId('clip');
    clip.scrollTop = 88;
    fireEvent.scroll(clip);
    rerender(<ClipLists items={withX} />);
    const real = document.querySelector<HTMLElement>('[data-flip-list="MF"][data-flip-id="x"]')!;
    const call = animate.mock.contexts.indexOf(real);
    // Was visible at (4, 92) inside the scrolled area; now MF slot (0, 300): moves down by 208.
    expect(animate.mock.calls[call][0][0].transform).toBe('translate(4px, -208px) scale(0.98, 1)');
    expect(document.querySelector('[data-flip-ghost]')).toBeNull();
  });
});

test('a second change during a move cancels the running animations instead of stacking them', () => {
  const { rerender } = render(<Lists items={before} />);
  rerender(<Lists items={pinnedB} />);
  const first = animate.mock.results.map(r => r.value as { cancel: jest.Mock });
  rerender(<Lists items={before} />);
  expect(first.every(a => a.cancel.mock.calls.length > 0 || a === undefined)).toBe(true);
});
