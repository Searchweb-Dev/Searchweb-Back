'use client';

import type { FolderResponse } from '@/lib/types/folder';
import { FolderMenu } from './FolderMenu';
import { cn } from '@/lib/utils';
import { pinnedCardHeight } from '@/lib/utils/pinnedScroll';

export function PinnedFolderCard({ folder, color, popup, onOpen, flipId }: {
  folder: FolderResponse; color: string; popup: boolean; onOpen: () => void;
  /** Shared with the My Folder card of the same folder so Pin/Unpin can animate between lists. */
  flipId?: number;
}) {
  return <div data-flip-id={flipId} data-flip-list={flipId == null ? undefined : 'P'}
    style={{ height: pinnedCardHeight(popup) }}
    className={cn(color, 'relative rounded-xl text-white focus-within:ring-2 focus-within:ring-purple-500',
    popup ? 'w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.34rem)] tablet-lg:w-[calc(16.666%-0.42rem)]'
      : 'w-[calc(50%-0.25rem)] lg:w-[calc(20%-0.4rem)]')}>
    <button type="button" onClick={onOpen} aria-label={`Open folder ${folder.folderName}`}
      className="flex h-full w-full flex-col justify-between rounded-xl p-3 text-left outline-none">
      <span className="material-symbols-outlined" aria-hidden="true">folder</span>
      <span className="max-w-full truncate text-xs font-semibold">{folder.folderName}</span>
    </button>
    <div className="absolute right-2 top-2"><FolderMenu folder={folder} pinnedCard /></div>
  </div>;
}
