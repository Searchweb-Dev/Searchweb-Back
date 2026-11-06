import type { FolderResponse } from '@/lib/types/folder';

export type PinnedSectionState = 'loading' | 'error' | 'ready';

/**
 * Single-exposure display policy (user decision, Pinned v8): a folder shown in Pinned is hidden from
 * My Folder. This is display-only — data is never moved or copied.
 * - ready: hide exactly the folders the Pinned section renders (GET pinned owns membership).
 * - loading: use the root response's `pinned` flag so pinned folders do not flash in My Folder.
 * - error: Pinned cannot render cards, so hide nothing and keep every folder reachable.
 */
export function myFolderHiddenIds(state: PinnedSectionState, pinnedShown: FolderResponse[], rootFolders: FolderResponse[] | undefined): Set<number> {
  if (state === 'ready') return new Set(pinnedShown.map(folder => folder.memberFolderId));
  if (state === 'loading') return new Set((rootFolders ?? []).filter(folder => folder.pinned).map(folder => folder.memberFolderId));
  return new Set();
}

export function withoutPinned(folders: FolderResponse[], hidden: Set<number>) {
  return hidden.size === 0 ? folders : folders.filter(folder => !hidden.has(folder.memberFolderId));
}
