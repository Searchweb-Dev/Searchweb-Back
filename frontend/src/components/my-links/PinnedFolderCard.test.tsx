import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FolderCard } from './FolderCard';
import { PinnedFolderCard } from './PinnedFolderCard';
import { useFolders, usePinnedFolders } from '@/lib/api/folderApi';
import { useAuthStore } from '@/lib/store/authStore';
import { FOLDER_TYPE, type FolderResponse } from '@/lib/types/folder';
import { fetchClient } from '@/lib/api/fetchClient';

jest.mock('@/lib/api/fetchClient', () => ({ ...jest.requireActual('@/lib/api/fetchClient'), fetchClient: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
const api = fetchClient as jest.Mock;
const folder = { memberFolderId: 9, ownerMemberId: 1, pinned: true, folderName: 'A',
  folderType: FOLDER_TYPE.CUSTOM, bookmarkCount: 3 } as FolderResponse;
const onOpen = jest.fn();
function Fixture() {
  const { data: root = [] } = useFolders(1);
  const { data: pinned = [] } = usePinnedFolders(1);
  return <><section aria-label="Pinned">{pinned.map(f => <PinnedFolderCard key={f.memberFolderId} folder={f} color="bg-purple-500" popup onOpen={onOpen} />)}</section>
    <section aria-label="My Folder">{root.map(f => <FolderCard key={f.memberFolderId} folder={f} />)}</section></>;
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['folders', 'root', 1], [folder]);
  client.setQueryData(['folders', 'pinned', 1], [folder]);
  client.setQueryData(['folders', 'root', 2], [{ ...folder, ownerMemberId: 2, folderName: 'Other account' }]);
  render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
  return client;
}
const trigger = (region: string) => within(screen.getByRole('region', { name: region })).getByRole('button', { name: /Folder actions/ });
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ member: { memberId: 1 } as NonNullable<ReturnType<typeof useAuthStore.getState>['member']> });
});
test('actual folderApi/cache: Unpin removes only shortcut, Pin restores; rename and confirmed delete invalidate both regions', async () => {
  let remote = [{ ...folder }];
  api.mockImplementation(async (path: string, options?: RequestInit) => {
    const data = options?.body ? JSON.parse(options.body as string) : {};
    if (options?.method === 'PATCH') { remote[0].pinned = data.pinned; return { ...remote[0] }; }
    if (options?.method === 'PUT') { remote[0].folderName = data.folderName; return undefined; }
    if (options?.method === 'DELETE') { remote = []; return undefined; }
    return path.endsWith('/pinned') ? remote.filter(f => f.pinned).map(f => ({ ...f })) : remote.map(f => ({ ...f }));
  });
  const client = setup();
  const pinnedTrigger = trigger('Pinned');
  const rootTrigger = trigger('My Folder');
  jest.spyOn(pinnedTrigger, 'getBoundingClientRect').mockReturnValue({ left: 24, bottom: 80 } as DOMRect);
  jest.spyOn(rootTrigger, 'getBoundingClientRect').mockReturnValue({ left: 400, bottom: 250 } as DOMRect);
  fireEvent.click(pinnedTrigger);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '24px', top: '84px' });
  expect(screen.getByRole('menuitem', { name: 'Unpin folder' }).querySelectorAll('svg path')).toHaveLength(2);
  expect(pinnedTrigger.closest('button')?.parentElement?.closest('button')).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin folder' }));
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Pinned' })).queryByRole('button')).toBeNull());
  expect(within(screen.getByRole('region', { name: 'My Folder' })).getByText('A')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/api/folders/9/pinned', { method: 'PATCH', body: '{"pinned":false}' });
  fireEvent.click(rootTrigger);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '400px', top: '254px' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Pin folder' }).querySelector('span')!);
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Pinned' })).getByText('A')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
  fireEvent.change(screen.getByPlaceholderText('Enter folder name'), { target: { value: 'Renamed' } });
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(screen.getAllByText('Renamed')).toHaveLength(2));
  expect(api).toHaveBeenCalledWith('/api/folders/9', { method: 'PUT', body: '{"folderName":"Renamed"}' });
  fireEvent.click(trigger('Pinned'));
  fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
  expect(remote).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryAllByText('Renamed')).toHaveLength(0));
  expect(api).toHaveBeenCalledWith('/api/folders/9', { method: 'DELETE' });
  expect(client.getQueryData<FolderResponse[]>(['folders', 'root', 2])?.[0].folderName).toBe('Other account');
  expect(onOpen).not.toHaveBeenCalled();
});
test('switching regions while saving cannot send a second PATCH; keyboard menu navigation and close restore instance focus', async () => {
  let release!: (folder: FolderResponse) => void;
  api.mockImplementation((path: string, options?: RequestInit) => options?.method === 'PATCH'
    ? new Promise<FolderResponse>(resolve => { release = resolve; }) : Promise.resolve([folder]));
  setup();
  fireEvent.click(trigger('Pinned'));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin folder' }));
  fireEvent.click(trigger('My Folder'));
  const action = screen.getByRole('menuitem', { name: 'Unpin folder' });
  expect(action).toBeDisabled();
  fireEvent.click(action);
  await waitFor(() => expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1));
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
  expect(screen.getByRole('menuitem', { name: /Delete/ })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(trigger('My Folder')).toHaveFocus();
  release(folder);
  await waitFor(() => expect(clientSaving()).toBe(false));
});
function clientSaving() { return screen.queryAllByLabelText('Saving').length > 0; }
test('unknown outcome remains locked across menu instances until server reads succeed, with no automatic second PATCH', async () => {
  api.mockRejectedValue(new TypeError('network'));
  setup();
  fireEvent.click(trigger('Pinned'));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin folder' }));
  await screen.findByRole('menuitem', { name: '다시 확인' });
  fireEvent.click(trigger('My Folder'));
  expect(screen.getByRole('menuitem', { name: 'Unpin folder' })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: '다시 확인' })).toBeInTheDocument();
  api.mockResolvedValue([folder]);
  fireEvent.click(screen.getByRole('menuitem', { name: '다시 확인' }));
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Unpin folder' })).toBeEnabled());
  expect(api.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1);
});
