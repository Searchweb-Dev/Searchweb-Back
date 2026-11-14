import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateFolderDialog } from './CreateFolderDialog';
import { useToastStore } from '@/lib/store/toastStore';
import { useUIStore } from '@/lib/store/uiStore';
import { ApiError } from '@/lib/api/fetchClient';

const mutate = jest.fn();
const invalidateQueries = jest.fn();
jest.mock('@/lib/api/folderApi', () => ({ useCreateFolder: () => ({ mutate, isPending: false }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
jest.mock('@/lib/store/authStore', () => ({
  useAuthStore: (sel: (s: { member: { memberId: number } }) => unknown) => sel({ member: { memberId: 1 } }),
}));

function openAndSubmit() {
  useUIStore.setState({ createFolderDialogOpen: true });
  render(<CreateFolderDialog />);
  fireEvent.change(screen.getByLabelText('Folder Name'), { target: { value: 'New' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Pin to Top' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
}

beforeEach(() => {
  mutate.mockReset();
  invalidateQueries.mockReset();
  useToastStore.setState({ toasts: [] });
  useUIStore.setState({ createFolderDialogOpen: false });
});

// Keep the component mounted, as in app/layout, across each close/open cycle.
test.each(['X', 'Cancel', 'Escape', 'outside', 'external', 'success'])('%s close resets pinned OFF on reopen (AC-01a)', async (path) => {
  useUIStore.setState({ createFolderDialogOpen: true });
  render(<CreateFolderDialog />);
  const pin = () => screen.getByRole('switch', { name: 'Pin to Top' });
  expect(pin()).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(pin());
  expect(pin()).toHaveAttribute('aria-checked', 'true');

  if (path === 'X') {
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
  } else if (path === 'Cancel') {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  } else if (path === 'Escape') {
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
  } else if (path === 'outside') {
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    // Radix installs the document outside-pointer listener on the next tick.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    fireEvent(overlay!, new MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false }));
    fireEvent.click(overlay!);
  } else if (path === 'external') {
    act(() => useUIStore.getState().toggleCreateFolderDialog(false));
  } else {
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    fireEvent.change(screen.getByLabelText('Folder Name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }), expect.anything());
  }

  expect(useUIStore.getState().createFolderDialogOpen).toBe(false);
  act(() => useUIStore.getState().toggleCreateFolderDialog(true));
  expect(pin()).toHaveAttribute('aria-checked', 'false');
});

test('confirmed create failure shows error toast and keeps dialog open (AC-01c/12a)', async () => {
  mutate.mockImplementation((_v, opts) => opts.onError(new ApiError({ status: 500, message: 'x' })));
  openAndSubmit();
  await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
  expect(useToastStore.getState().toasts[0]).toMatchObject({ kind: 'error' });
  expect(useToastStore.getState().toasts[0].message).toContain('실패');
  expect(useUIStore.getState().createFolderDialogOpen).toBe(true);
  expect(screen.getByRole('switch', { name: 'Pin to Top' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('Folder Name')).toHaveValue('New');
  expect(invalidateQueries).not.toHaveBeenCalled();
});

test('unknown create outcome re-queries folders and pinned, no success shown (AC-12b)', async () => {
  mutate.mockImplementation((_v, opts) => opts.onError(new TypeError('network')));
  openAndSubmit();
  await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['folders'] }, { throwOnError: true }));
  await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toContain('확인'));
  expect(useUIStore.getState().createFolderDialogOpen).toBe(true);
  expect(screen.getByRole('switch', { name: 'Pin to Top' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('Folder Name')).toHaveValue('New');
});

test.each(['resolves', 'rejects'])('unknown create outcome keeps Create disabled until the refresh %s', async (outcome) => {
  let settle!: () => void;
  invalidateQueries.mockReturnValue(new Promise<void>((resolve, reject) => {
    settle = outcome === 'resolves' ? resolve : () => reject(new TypeError('offline'));
  }));
  mutate.mockImplementation((_v, opts) => { void opts.onError(new TypeError('network')); });
  openAndSubmit();
  const create = screen.getByRole('button', { name: 'Create Folder' });
  await waitFor(() => expect(create).toBeDisabled());
  fireEvent.click(create);
  expect(mutate).toHaveBeenCalledTimes(1);
  await act(async () => { settle(); });
  await waitFor(() => expect(create).toBeEnabled());
  expect(useToastStore.getState().toasts).toHaveLength(1);
});

test('unknown create outcome waits for refresh and does not claim a failed refresh succeeded', async () => {
  let rejectRefresh!: (reason: Error) => void;
  invalidateQueries.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectRefresh = reject; }));
  mutate.mockImplementation((_v, opts) => { void opts.onError(new TypeError('network')); });
  openAndSubmit();
  expect(useToastStore.getState().toasts).toHaveLength(0);
  rejectRefresh(new TypeError('offline'));
  await waitFor(() => expect(useToastStore.getState().toasts[0]?.message).toContain('다시 확인'));
  expect(useToastStore.getState().toasts[0].message).not.toContain('불러왔');
  expect(useUIStore.getState().createFolderDialogOpen).toBe(true);
  expect(screen.getByRole('switch', { name: 'Pin to Top' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('Folder Name')).toHaveValue('New');
});
