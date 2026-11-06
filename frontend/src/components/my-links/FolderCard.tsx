'use client';

import { type FolderResponse } from '@/lib/types/folder';
import { useFolderStore } from '@/lib/store/folderStore';
import { useLinkStore } from '@/lib/store/linkStore';
import { useUIStore } from '@/lib/store/uiStore';
import { ANALYTICS_EVENTS, trackEvent } from '@/lib/analytics';
import { FolderMenu } from './FolderMenu';

interface FolderCardProps {
  folder: FolderResponse;
  color?: string;
  variant?: 'default' | 'popup';
}

export function FolderCard({ folder, color, variant = 'default' }: FolderCardProps) {
  const setSelectedFolderId = useFolderStore(s => s.setSelectedFolderId);
  const currentSelectedFolderId = useFolderStore(s => s.selectedFolderId);
  const searchQuery = useFolderStore(s => s.searchQuery);
  const setLinkSearchQuery = useLinkStore(s => s.setSearchQuery);
  const isAllLinks = folder.memberFolderId === -1;
  const isSelected = isAllLinks
    ? (currentSelectedFolderId === null && useUIStore.getState().rightPanelOpen)
    : currentSelectedFolderId === folder.memberFolderId;
  const isPopupCard = variant === 'popup';
  const handleCardClick = () => {
    if (isAllLinks) {
      setSelectedFolderId(null);
      useUIStore.getState().toggleRightPanel(true);
    } else if (currentSelectedFolderId === folder.memberFolderId) {
      setSelectedFolderId(null);
    } else {
      setSelectedFolderId(folder.memberFolderId);
      trackEvent(ANALYTICS_EVENTS.FOLDER_CLICK, { event_params: { result_count: folder.bookmarkCount } });
      if (searchQuery) setLinkSearchQuery(searchQuery);
      useUIStore.getState().toggleRightPanel(true);
    }
  };

  return <div className={`bg-white dark:bg-card-dark border transition-all duration-300 group relative overflow-visible ${
    isPopupCard
      ? 'flex h-[88px] flex-col justify-between rounded-xl p-3 shadow-xs hover:shadow-md hover:-translate-y-0.5'
      : 'flex h-[72px] items-center gap-2 rounded-lg px-3 py-2.5'
  } ${isSelected
    ? 'border-purple-500 bg-purple-50/40 dark:border-purple-400 dark:bg-purple-500/10 shadow-sm hover:bg-purple-50/40 dark:hover:bg-purple-500/10'
    : 'border-gray-200/70 dark:border-white/5 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-white/10 hover:bg-purple-50/30 dark:hover:bg-white/[0.03]'
  } ${color || ''}`}>
    {/* Native open button and action trigger are siblings, never nested interactive elements. */}
    <button type="button" aria-label={`Open folder ${folder.folderName}`} onClick={handleCardClick}
      className="absolute inset-0 h-full w-full cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-purple-500" />
    <div className={`${isPopupCard ? 'flex justify-between items-start' : 'contents'} pointer-events-none`}>
      <div className={`bg-purple-50 dark:bg-white/5 text-gray-400 dark:text-slate-400 group-hover:dark:text-white transition-colors flex items-center justify-center ${isPopupCard ? 'w-7 h-7 rounded-lg' : 'order-1 h-8 w-8 shrink-0 rounded-md'}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{isAllLinks ? 'bookmarks' : 'folder_open'}</span>
      </div>
    </div>
    <div className={`${isPopupCard ? 'pr-2' : 'order-2 min-w-0 flex-1 pr-5'} pointer-events-none`}>
      <h4 className={`font-semibold text-gray-800 dark:text-white truncate ${isPopupCard ? 'mt-0.5 text-[11.5px]' : 'text-[11.5px]'}`}>{folder.folderName}</h4>
      <p className="text-[9.5px] font-medium text-gray-400 dark:text-slate-400">{folder.bookmarkCount} {isPopupCard ? 'links' : 'Links'}</p>
    </div>
    {!isAllLinks && <div className={`absolute right-3 ${isPopupCard ? 'top-3' : 'top-1/2 -translate-y-1/2'}`}><FolderMenu folder={folder} /></div>}
    {isAllLinks && !isPopupCard && <span aria-hidden="true" className="material-symbols-outlined pointer-events-none order-3 ml-auto shrink-0 text-[18px] text-gray-300 dark:text-slate-500">more_horiz</span>}
  </div>;
}
