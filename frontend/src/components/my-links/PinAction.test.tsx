import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PinAction } from './PinAction';
import { ApiError } from '@/lib/api/fetchClient';
import type { FolderResponse } from '@/lib/types/folder';

const mutateAsync = jest.fn();
jest.mock('@/lib/api/folderApi', () => ({ useSetFolderPinned: () => ({ mutateAsync }) }));
jest.mock('@/lib/api/fetchClient', () => {
  const actual = jest.requireActual('@/lib/api/fetchClient');
  return { ...actual, fetchClient: jest.fn() };
});
import { fetchClient } from '@/lib/api/fetchClient';
const folder = { memberFolderId: 9, ownerMemberId: 1, pinned: false, folderName: 'A' } as FolderResponse;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PinAction folder={folder} ownerMemberId={1} /></QueryClientProvider>);
}

import { useToastStore } from '@/lib/store/toastStore';
beforeEach(() => { mutateAsync.mockReset(); (fetchClient as jest.Mock).mockReset(); useToastStore.setState({ toasts: [] }); });
test('sends the target value once even during repeated clicks and shows spinner', async () => {
  let release!: () => void;
  mutateAsync.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  mount();
  const button = screen.getByRole('button', { name: 'Pin folder' });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByLabelText('Saving')).toBeInTheDocument();
  fireEvent.click(button);
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  expect(mutateAsync).toHaveBeenCalledWith({ folderId: 9, pinned: true });
  release();
  await waitFor(() => expect(button).not.toBeDisabled());
});
test('confirmed failure offers feedback and permits retry', async () => {
  mutateAsync.mockRejectedValue(new ApiError({ status: 403, message: 'Forbidden' }));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pin folder' }));
  await waitFor(() => expect(useToastStore.getState().toasts.map(t => t.message).join()).toContain('실패'));
  expect(useToastStore.getState().toasts[0].kind).toBe('error');
  // Z-D1: no inline alert text inside the card
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Pin folder' })).not.toBeDisabled();
});
test('uncertain transport outcome requires server recheck before retry', async () => {
  mutateAsync.mockRejectedValue(new TypeError('network'));
  (fetchClient as jest.Mock).mockRejectedValueOnce(new TypeError('network')).mockResolvedValue([]);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pin folder' }));
  await waitFor(() => expect(screen.getByText('다시 확인')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Pin folder' })).toBeDisabled();
  fireEvent.click(screen.getByText('다시 확인'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pin folder' })).not.toBeDisabled());
  expect(mutateAsync).toHaveBeenCalledTimes(1);
});
