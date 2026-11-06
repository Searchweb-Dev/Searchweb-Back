'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FOLDER_TYPE, type FolderResponse } from '@/lib/types/folder';
import { useAuthStore } from '@/lib/store/authStore';
import { FolderEditModal, FolderDeleteModal } from './FolderManagementModals';
import { PinAction } from './PinAction';
import { folderMenuPosition } from './folderMenuPosition';
import { visibleWithin } from '@/lib/utils/pinnedScroll';

const OPEN_EVENT = 'searchweb:folder-menu-open';
const rowClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-purple-500 focus-visible:-outline-offset-2';
const iconClass = 'material-symbols-outlined flex h-5 w-5 min-w-5 shrink-0 items-center justify-center !text-[16px] !leading-5 overflow-visible';

export function FolderMenu({ folder, pinnedCard = false }: { folder: FolderResponse; pinnedCard?: boolean }) {
  const memberId = useAuthStore(s => s.member?.memberId);
  const id = useId(); // identity belongs to this rendered trigger, never to the folder ID
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const hasPosition = position !== null;
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const system = folder.folderType === FOLDER_TYPE.UNORGANIZED;
  const close = (restore = true) => {
    setOpen(false);
    if (restore && triggerRef.current?.isConnected) triggerRef.current.focus();
  };

  useEffect(() => {
    const otherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, otherOpened);
    return () => window.removeEventListener(OPEN_EVENT, otherOpened);
  }, [id]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = (event?: Event) => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      // Inside a scroll area (two-row Pinned list) the menu follows its button while the area
      // scrolls and closes once the button has scrolled out of view, so it never floats detached.
      const clip = anchor.closest('[data-flip-clip]');
      if (event?.type === 'scroll' && clip && !visibleWithin(clip.getBoundingClientRect(), anchor.getBoundingClientRect())) {
        setOpen(false);
        return;
      }
      const width = menuRef.current?.offsetWidth || 112;
      const height = menuRef.current?.offsetHeight || 134;
      setPosition(folderMenuPosition(anchor.getBoundingClientRect(), width, height,
        { width: window.innerWidth, height: window.innerHeight }));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // Retry row / spinner can change measured height.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    if (menuRef.current) observer?.observe(menuRef.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
        // A different trigger must receive focus rather than the previous one stealing it.
        if (!(target instanceof Element && target.closest('[data-folder-menu-trigger]'))) triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open, hasPosition]);

  return <>
    <button ref={triggerRef} type="button" data-folder-menu-trigger="" aria-label={`Folder actions ${folder.folderName}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      className={pinnedCard
        ? 'flex h-6 w-6 items-center justify-center rounded text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
        : 'flex h-5 w-5 items-center justify-center rounded text-gray-300 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 focus-visible:outline-2 focus-visible:outline-purple-500'}
      onClick={event => {
        event.stopPropagation();
        if (open) close();
        else { window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id })); setOpen(true); }
      }}>
      <span aria-hidden="true" className="material-symbols-outlined !text-[18px] !leading-none">more_horiz</span>
    </button>
    {/* Keep the action mounted after first open: closing a menu must not reset unknown/saving. */}
    {(open || position) && createPortal(<div id={id} ref={menuRef} role="menu" aria-label={`Actions for ${folder.folderName}`}
      hidden={!open} className="fixed z-popover w-28 max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-gray-100 bg-white py-1 shadow-xl dark:border-white/8 dark:bg-slate-950"
      style={{ left: position?.left ?? 8, top: position?.top ?? 8, visibility: position ? 'visible' : 'hidden' }}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
          items[index]?.focus();
        }
        if (event.key === 'Tab') close(false);
      }}>
      <button type="button" role="menuitem" className={`${rowClass} text-gray-700 hover:bg-purple-50 dark:text-white dark:hover:bg-purple-600/20`}
        onClick={() => { close(false); setModal('edit'); }}>
        <span aria-hidden="true" className={iconClass}>edit</span><span>Rename</span>
      </button>
      {memberId != null && <PinAction folder={folder} ownerMemberId={memberId} menuItem />}
      <div role="separator" className="my-0.5 h-px bg-gray-50 dark:bg-white/8" />
      <button type="button" role="menuitem" disabled={system}
        className={`${rowClass} text-rose-500 hover:bg-rose-50 dark:text-red-400 dark:hover:bg-purple-600/20 disabled:cursor-not-allowed disabled:opacity-40`}
        onClick={() => { if (!system) { close(false); setModal('delete'); } }}>
        <span aria-hidden="true" className={iconClass}>delete</span><span>Delete</span>
      </button>
    </div>, document.body)}
    {/* Modals go under <body>: the trigger's wrapper is transformed (-translate-y-1/2 / hover lift), and a
        transformed ancestor would become the containing block of the modal's `fixed inset-0` overlay. */}
    {modal === 'edit' && createPortal(<FolderEditModal folder={folder} onClose={() => { setModal(null); triggerRef.current?.focus(); }} />, document.body)}
    {modal === 'delete' && createPortal(<FolderDeleteModal folder={folder} onClose={() => { setModal(null); triggerRef.current?.focus(); }} />, document.body)}
  </>;
}
