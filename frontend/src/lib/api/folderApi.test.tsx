import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetFolderPinned } from './folderApi';
import { fetchClient } from './fetchClient';
import type { FolderResponse } from '@/lib/types/folder';

jest.mock('./fetchClient', () => ({ fetchClient: jest.fn() }));
const root = { memberFolderId: 9, ownerMemberId: 1, pinned: false, folderName: 'A' } as FolderResponse;
const confirmed = { ...root, pinned: true };
const api = fetchClient as jest.Mock;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['folders', 'root', 1], [root]);
  client.setQueryData(['folders', 'pinned', 1], []);
  client.setQueryData(['folders', 'root', 2], [{ ...root, ownerMemberId: 2 }]);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useSetFolderPinned(1), { wrapper }) };
}
beforeEach(() => api.mockReset());
test('confirmed server value updates only current account cached root and pinned ids', async () => {
  api.mockResolvedValue(confirmed);
  const { client, result } = setup();
  await act(async () => { await result.current.mutateAsync({ folderId: 9, pinned: true }); });
  expect(api).toHaveBeenCalledWith('/api/folders/9/pinned', { method: 'PATCH', body: JSON.stringify({ pinned: true }) });
  expect(client.getQueryData<FolderResponse[]>(['folders', 'root', 1])?.[0].pinned).toBe(true);
  expect(client.getQueryData<FolderResponse[]>(['folders', 'pinned', 1])?.map(f => f.memberFolderId)).toEqual([9]);
  expect(client.getQueryData<FolderResponse[]>(['folders', 'root', 2])?.[0].ownerMemberId).toBe(2);
});
test('confirmed failure keeps cached server state intact', async () => {
  api.mockRejectedValue(new Error('forbidden'));
  const { client, result } = setup();
  await act(async () => { await expect(result.current.mutateAsync({ folderId: 9, pinned: true })).rejects.toThrow(); });
  await waitFor(() => expect(client.getQueryData<FolderResponse[]>(['folders', 'root', 1])?.[0].pinned).toBe(false));
  expect(client.getQueryData(['folders', 'pinned', 1])).toEqual([]);
});
