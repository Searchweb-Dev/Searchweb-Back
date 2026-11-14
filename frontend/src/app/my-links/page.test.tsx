import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyLinksPage from './page';
import { fetchClient, ApiError } from '@/lib/api/fetchClient';
import { useAuthStore } from '@/lib/store/authStore';
import { useFolderStore } from '@/lib/store/folderStore';
import { useToastStore } from '@/lib/store/toastStore';
import { useUIStore } from '@/lib/store/uiStore';
import { FOLDER_TYPE, type FolderResponse } from '@/lib/types/folder';

jest.mock('@/lib/api/fetchClient', () => ({ ...jest.requireActual('@/lib/api/fetchClient'), fetchClient: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
jest.mock('@/components/my-links/RightPanel', () => ({ RightPanel: () => null }));
jest.mock('@/lib/api/bookmarkApi', () => ({
  useBookmarks: () => ({ data: undefined, isFetching: false, isError: false }),
}));

const api = fetchClient as jest.Mock;
const make = (id: number, name: string, pinned = false, type: FolderResponse['folderType'] = FOLDER_TYPE.CUSTOM): FolderResponse => ({
  memberFolderId: id, ownerMemberId: 1, parentFolderId: null, folderName: name, description: null,
  folderType: type, bookmarkCount: id, pinned,
});

let remote: FolderResponse[];
function serve(patch?: (folderId: number, pinned: boolean) => Promise<FolderResponse>) {
  api.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      const folderId = Number(path.match(/folders\/(\d+)\/pinned/)![1]);
      const { pinned } = JSON.parse(options.body as string);
      if (patch) return patch(folderId, pinned);
      const target = remote.find(f => f.memberFolderId === folderId)!;
      target.pinned = pinned;
      return { ...target };
    }
    if (path.endsWith('/me/pinned')) return remote.filter(f => f.pinned).map(f => ({ ...f }));
    if (path.includes('/root')) return remote.map(f => ({ ...f }));
    return [];
  });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['folders', 'root', 1], remote.map(f => ({ ...f })));
  client.setQueryData(['folders', 'pinned', 1], remote.filter(f => f.pinned).map(f => ({ ...f })));
  render(<QueryClientProvider client={client}><MyLinksPage /></QueryClientProvider>);
  return client;
}

const pinnedRegion = () => screen.getByRole('region', { name: 'Pinned folders' });
const myFolderRegion = () => screen.getByRole('group', { name: 'My Folder list' });
const names = (region: HTMLElement) => within(region).queryAllByRole('button', { name: /^Open folder / })
  .map(button => button.getAttribute('aria-label')!.replace('Open folder ', ''));

// Every committed DOM state must render each folder in at most one list.
function watchSingleExposure() {
  const violations: string[] = [];
  const check = () => {
    const seen = new Map<string, number>();
    document.querySelectorAll('[aria-label^="Open folder "]').forEach(el => {
      const name = el.getAttribute('aria-label')!;
      seen.set(name, (seen.get(name) ?? 0) + 1);
    });
    seen.forEach((count, name) => { if (count > 1) violations.push(name); });
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  return { violations, stop: () => observer.disconnect(), check };
}

beforeEach(() => {
  jest.clearAllMocks();
  remote = [make(1, 'One'), make(2, 'Two'), make(3, 'Three', true), make(4, 'Four'), make(5, 'Inbox', false, FOLDER_TYPE.UNORGANIZED)];
  serve();
  useAuthStore.setState({ member: { memberId: 1 } as NonNullable<ReturnType<typeof useAuthStore.getState>['member']>, isInitializing: false });
  useFolderStore.setState({ searchQuery: '', searchScope: 'all', savedTodayFilter: false, unreadFilter: false, unorganizedFilter: false, selectedFolderId: null });
  useToastStore.setState({ toasts: [] });
});

test('a pinned folder is shown only in Pinned; My Folder keeps the remaining folders in existing sort order', () => {
  setup();
  expect(names(pinnedRegion())).toEqual(['Three']);
  expect(names(myFolderRegion())).toEqual(['All Links', 'Inbox', 'Four', 'Two', 'One']);
  // All Links still counts every folder: display policy only, data is not moved.
  expect(within(myFolderRegion()).getByText(/^15 links$/i)).toBeInTheDocument();
});

test('Unpin removes the card from Pinned, returns it to its original My Folder position and closes the menu', async () => {
  setup();
  const watch = watchSingleExposure();
  fireEvent.click(within(pinnedRegion()).getByRole('button', { name: 'Folder actions Three' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin folder' }));
  await waitFor(() => expect(names(pinnedRegion())).toEqual([]));
  expect(within(pinnedRegion()).getByText(/자주 찾는 폴더를 고정해보세요/)).toBeInTheDocument();
  expect(names(myFolderRegion())).toEqual(['All Links', 'Inbox', 'Four', 'Three', 'Two', 'One']);
  expect(screen.queryByRole('menu')).toBeNull();
  // The moved card's own trigger receives focus instead of leaving it on <body>.
  expect(within(myFolderRegion()).getByRole('button', { name: 'Folder actions Three' })).toHaveFocus();
  watch.check(); watch.stop();
  expect(watch.violations).toEqual([]);
});

test('Pin moves the card from My Folder to Pinned with no frame showing it in both lists', async () => {
  setup();
  const watch = watchSingleExposure();
  fireEvent.click(within(myFolderRegion()).getByRole('button', { name: 'Folder actions Two' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Pin folder' }));
  await waitFor(() => expect(names(pinnedRegion())).toEqual(['Three', 'Two']));
  expect(names(myFolderRegion())).toEqual(['All Links', 'Inbox', 'Four', 'One']);
  expect(screen.queryByRole('menu')).toBeNull();
  watch.check(); watch.stop();
  expect(watch.violations).toEqual([]);
});

test('a failed save keeps the card in its original list, keeps the failure toast and sends one PATCH', async () => {
  serve(() => Promise.reject(new ApiError({ status: 500, message: 'boom' })));
  setup();
  fireEvent.click(within(myFolderRegion()).getByRole('button', { name: 'Folder actions Two' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Pin folder' }));
  await waitFor(() => expect(useToastStore.getState().toasts.map(t => t.message).join()).toContain('고정 상태 저장에 실패했습니다'));
  expect(names(pinnedRegion())).toEqual(['Three']);
  expect(names(myFolderRegion())).toEqual(['All Links', 'Inbox', 'Four', 'Two', 'One']);
  expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1);
});

test('a folder created with Pin ON appears only in Pinned after the creation refetch', async () => {
  const client = setup();
  remote.push(make(6, 'Created', true));
  await act(async () => { await client.invalidateQueries({ queryKey: ['folders'] }); });
  await waitFor(() => expect(names(pinnedRegion())).toEqual(['Created', 'Three']));
  expect(names(myFolderRegion())).not.toContain('Created');
});

test('search and the Unorganized filter list only unpinned folders, with matching counts', () => {
  remote = [make(1, 'Alpha one'), make(2, 'Alpha two', true), make(5, 'Inbox', true, FOLDER_TYPE.UNORGANIZED)];
  useFolderStore.setState({ searchQuery: 'alpha', searchScope: 'folders' });
  setup();
  const results = screen.getByRole('group', { name: 'Folder search results' });
  expect(names(results)).toEqual(['Alpha one']);
  expect(screen.getByText('1 folders found')).toBeInTheDocument();
  expect(names(pinnedRegion())).toEqual(['Inbox', 'Alpha two']);
});

test('while the pinned query is still loading, root pinned flags already keep the folder out of My Folder', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['folders', 'root', 1], remote.map(f => ({ ...f })));
  api.mockImplementation(() => new Promise(() => {}));
  render(<QueryClientProvider client={client}><MyLinksPage /></QueryClientProvider>);
  expect(within(pinnedRegion()).getByRole('status')).toBeInTheDocument();
  expect(names(myFolderRegion())).not.toContain('Three');
});

test('if the pinned list fails to load, pinned folders stay reachable in My Folder instead of disappearing', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['folders', 'root', 1], remote.map(f => ({ ...f })));
  api.mockImplementation(async (path: string) => {
    if (path.endsWith('/me/pinned')) throw new ApiError({ status: 500, message: 'down' });
    return remote;
  });
  render(<QueryClientProvider client={client}><MyLinksPage /></QueryClientProvider>);
  await within(pinnedRegion()).findByRole('alert');
  expect(names(myFolderRegion())).toContain('Three');
});

// ── Pinned: max two rows, inner vertical scroll ─────────────────────────────
describe('Pinned area limited to two rows', () => {
  const pinnedList = () => screen.getByRole('group', { name: 'Pinned folder list' });
  const cardOf = (name: string) => within(pinnedList()).getByRole('button', { name: `Open folder ${name}` }).closest<HTMLElement>('[data-flip-id]')!;
  const rect = (top: number, height: number, left = 0, width = 100) =>
    ({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON() {} }) as DOMRect;
  let sizes: { scrollHeight: number; clientHeight: number };

  beforeEach(() => {
    remote = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((name, i) => make(i + 1, name, true));
    remote.push(make(7, 'Loose'));
    sizes = { scrollHeight: 264, clientHeight: 176 };
    jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.pinnedScroll !== undefined ? sizes.scrollHeight : 0;
    });
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.pinnedScroll !== undefined ? sizes.clientHeight : 0;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test('the card list is a scroll container capped at two card rows; page layout height does not depend on the count', () => {
    setup(); // default panelMode 'drawer' → popup layout (92px cards)
    const list = pinnedList();
    expect(list).toHaveAttribute('data-pinned-scroll');
    expect(list).toHaveAttribute('data-flip-clip');
    expect(list.style.maxHeight).toBe('200px');
    expect(list.className).toMatch(/overflow-y-auto/);
    // No count cap: every pinned folder is rendered (flex-wrap kept).
    expect(names(pinnedRegion())).toHaveLength(6);
    expect(list.querySelector('.flex.flex-wrap')).not.toBeNull();
    // Inner padding offset by a negative margin keeps focus rings unclipped without moving the layout.
    expect(list.className).toMatch(/(^|\s)-m-1(\s|$)/);
    expect(list.className).toMatch(/(^|\s)p-1(\s|$)/);
  });

  test('scroll indication is on only when cards exceed two rows', () => {
    setup();
    expect(pinnedList()).toHaveAttribute('data-scrollable', 'true');
  });

  test('two rows or fewer: no scroll indication', () => {
    sizes = { scrollHeight: 176, clientHeight: 176 };
    setup();
    expect(pinnedList()).toHaveAttribute('data-scrollable', 'false');
  });

  test('pinned card dimensions come from the same height constant as the two-row cap', () => {
    setup();
    expect(cardOf('A1').style.height).toBe('92px');
    expect(pinnedList().style.maxHeight).toBe('200px'); // 2 × 92 + 8 + 2 × 4
  });

  test('fixed panel layout: 80px cards, 176px two-row cap', () => {
    useUIStore.setState({ panelMode: 'fixed' });
    try {
      setup();
      expect(cardOf('A1').style.height).toBe('80px');
      expect(pinnedList().style.maxHeight).toBe('176px'); // 2 × 80 + 8 + 2 × 4
    } finally {
      useUIStore.setState({ panelMode: 'drawer' });
    }
  });

  test('Tab focus on a card below the visible rows scrolls the Pinned area to it', () => {
    setup();
    const list = pinnedList();
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const node = this as HTMLElement;
      if (node.dataset.pinnedScroll !== undefined) return rect(100, 176);
      if (node.dataset.flipId === '5') return rect(280, 80); // third row (folders sorted, id 5 = A5)
      return rect(0, 0);
    });
    act(() => { within(list).getByRole('button', { name: 'Open folder A5' }).focus(); });
    // bottom 360 + 4 (ring padding) - 276 = 88
    expect(list.scrollTop).toBe(88);
  });

  test('the … menu of a card follows its button while the area scrolls and closes once the button scrolls out', () => {
    setup();
    const list = pinnedList();
    let triggerTop = 120;
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const node = this as HTMLElement;
      if (node.dataset.pinnedScroll !== undefined) return rect(100, 176, 0, 600);
      if (node.getAttribute('aria-label') === 'Folder actions A1') return rect(triggerTop, 24, 200, 24);
      return rect(0, 0);
    });
    fireEvent.click(within(list).getByRole('button', { name: 'Folder actions A1' }));
    const menu = screen.getByRole('menu');
    const firstTop = menu.style.top;
    triggerTop = 160;
    fireEvent.scroll(list);
    expect(screen.getByRole('menu')).toBe(menu);
    expect(menu.style.top).not.toBe(firstTop); // follows the button, no stale anchor
    triggerTop = 40; // scrolled above the visible area
    fireEvent.scroll(list);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
