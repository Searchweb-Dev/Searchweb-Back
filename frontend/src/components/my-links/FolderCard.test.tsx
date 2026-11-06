import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FolderCard } from './FolderCard';
import { PinnedFolderCard } from './PinnedFolderCard';
import { useAuthStore } from '@/lib/store/authStore';
import { useFolderStore } from '@/lib/store/folderStore';
import { FOLDER_TYPE, type FolderResponse } from '@/lib/types/folder';

const mutateAsync = jest.fn();
const update = jest.fn();
const remove = jest.fn();
jest.mock('@/lib/api/folderApi', () => ({
  useSetFolderPinned: () => ({ mutateAsync }),
  useUpdateFolder: () => ({ mutate: update, isPending: false }),
  useDeleteFolder: () => ({ mutate: remove, isPending: false }),
}));
jest.mock('@/lib/analytics', () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
const folder = { memberFolderId: 9, ownerMemberId: 1, pinned: false, folderName: 'A',
  folderType: FOLDER_TYPE.CUSTOM, bookmarkCount: 3 } as FolderResponse;
function mount(children: React.ReactNode = <FolderCard folder={folder} />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
function trigger(index = 0) { return screen.getAllByText('more_horiz')[index].closest('button')!; }
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ member: { memberId: 1 } as NonNullable<ReturnType<typeof useAuthStore.getState>['member']> });
  useFolderStore.setState({ selectedFolderId: null });
  mutateAsync.mockResolvedValue(undefined);
});
test('menu has ordered full-row actions and does not open the folder', async () => {
  mount();
  fireEvent.click(trigger());
  const menu = screen.getByRole('menu');
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['editRename', 'Pin', 'deleteDelete']);
  const pin = within(menu).getByRole('menuitem', { name: 'Pin folder' });
  expect(pin).toHaveClass('w-full');
  expect(pin.querySelector('svg path')).toHaveAttribute('d', 'm9.3 5.25 5.4 0-.9 5.4 3.6 3.6v1.8H6.6v-1.8l3.6-3.6zM12 16.05v2.7');
  fireEvent.click(pin.querySelector('svg')!);
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ folderId: 9, pinned: true }));
  expect(useFolderStore.getState().selectedFolderId).toBeNull();
});
test('two copies of the same folder anchor to the clicked instance; one menu and Esc focus return', () => {
  mount(<><FolderCard folder={folder} /><FolderCard folder={folder} /></>);
  const first = trigger(0), second = trigger(1);
  jest.spyOn(first, 'getBoundingClientRect').mockReturnValue({ left: 30, bottom: 60 } as DOMRect);
  jest.spyOn(second, 'getBoundingClientRect').mockReturnValue({ left: 300, bottom: 160 } as DOMRect);
  fireEvent.click(first);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '30px', top: '64px' });
  fireEvent.click(second);
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '300px', top: '164px' });
  expect(second).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(second).toHaveFocus();
});
test('outside click closes; scroll and resize recalculate the actual trigger', () => {
  mount();
  const button = trigger();
  const rect = jest.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 40, bottom: 80 } as DOMRect);
  fireEvent.click(button);
  rect.mockReturnValue({ left: 80, bottom: 120 } as DOMRect);
  fireEvent.scroll(window);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '80px', top: '124px' });
  rect.mockReturnValue({ left: 90, bottom: 130 } as DOMRect);
  fireEvent.resize(window);
  expect(screen.getByRole('menu')).toHaveStyle({ left: '90px', top: '134px' });
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(button).toHaveFocus();
});
test('Rename and Delete retain real modal and confirmation behavior', () => {
  mount();
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
  fireEvent.change(screen.getByPlaceholderText('Enter folder name'), { target: { value: 'Renamed' } });
  fireEvent.click(screen.getByText('Save Changes'));
  expect(update).toHaveBeenCalledWith({ folderId: 9, data: { folderName: 'Renamed' } }, expect.anything());
  fireEvent.click(screen.getByText('Cancel'));
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByText('Delete Folder')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith(9, expect.anything());
});
// QA #5: the card's menu wrapper is `-translate-y-1/2` (and popup cards `hover:-translate-y-0.5`); a
// transformed ancestor becomes the containing block of `position: fixed`, so an in-card modal is
// squeezed into the 20px trigger box and clipped by the scroll area. Modals must render under <body>.
test.each([
  ['My Folder card', () => <FolderCard folder={folder} />],
  ['My Folder popup card', () => <FolderCard folder={folder} variant="popup" />],
  ['Pinned card', () => <PinnedFolderCard folder={{ ...folder, pinned: true }} color="bg-purple-500" popup={false} onOpen={jest.fn()} />],
])('%s: Rename/Delete modal is portaled to body, outside the card; focus enters and returns', (_name, card) => {
  const { container } = mount(card());
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
  const input = screen.getByPlaceholderText('Enter folder name');
  const overlay = screen.getByText('Rename Folder').closest('.fixed')!;
  expect(overlay.parentElement).toBe(document.body);
  expect(container.contains(overlay)).toBe(false);
  expect(input).toHaveFocus();
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText('Rename Folder')).toBeNull();
  expect(trigger()).toHaveFocus();
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
  const deleteOverlay = screen.getByText('Delete Folder').closest('.fixed')!;
  expect(deleteOverlay.parentElement).toBe(document.body);
  expect(container.contains(deleteOverlay)).toBe(false);
  fireEvent.click(screen.getByText('Cancel'));
  expect(screen.queryByText('Delete Folder')).toBeNull();
});
test('UNORGANIZED can pin and rename, but cannot delete; All Links has no menu', () => {
  const view = mount(<FolderCard folder={{ ...folder, folderType: FOLDER_TYPE.UNORGANIZED }} />);
  fireEvent.click(trigger());
  expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: 'Pin folder' })).toBeEnabled();
  view.unmount();
  mount(<FolderCard folder={{ ...folder, memberFolderId: -1 }} />);
  expect(screen.queryByRole('button', { name: /Folder actions/ })).toBeNull();
});
