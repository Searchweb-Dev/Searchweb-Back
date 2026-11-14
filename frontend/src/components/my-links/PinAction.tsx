'use client';

import { useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSetFolderPinned } from '@/lib/api/folderApi';
import { ApiError } from '@/lib/api/fetchClient';
import { fetchClient } from '@/lib/api/fetchClient';
import { showToast } from '@/lib/store/toastStore';
import type { FolderResponse } from '@/lib/types/folder';
import { PinIcon } from './PinIcon';

// Both rendered copies share the request/unknown lock, scoped to client + account + folder.
// Menu switching must not allow a duplicate PATCH or bypass an unresolved outcome.
const initialState = { saving: false, unknown: false };
function createActionState() {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); },
  };
}
const actionStates = new WeakMap<QueryClient, Map<string, ReturnType<typeof createActionState>>>();
function actionState(client: QueryClient, key: string) {
  let states = actionStates.get(client);
  if (!states) { states = new Map(); actionStates.set(client, states); }
  let state = states.get(key);
  if (!state) { state = createActionState(); states.set(key, state); }
  return state;
}

export function PinAction({ folder, ownerMemberId, menuItem = false }: { folder: FolderResponse; ownerMemberId: number; menuItem?: boolean }) {
  const mutation = useSetFolderPinned(ownerMemberId);
  const queryClient = useQueryClient();
  const shared = actionState(queryClient, `${ownerMemberId}:${folder.memberFolderId}`);
  const { saving, unknown } = useSyncExternalStore(shared.subscribe, shared.getSnapshot, () => initialState);
  const recheck = async () => {
    await queryClient.fetchQuery({ queryKey: ['folders', 'pinned', ownerMemberId],
      queryFn: () => fetchClient<FolderResponse[]>('/api/folders/me/pinned'), staleTime: 0 });
    await queryClient.fetchQuery({ queryKey: ['folders', 'root', ownerMemberId],
      queryFn: () => fetchClient<FolderResponse[]>(`/api/folders/owners/${ownerMemberId}/root`), staleTime: 0 });
  };
  const action = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (shared.getSnapshot().saving || shared.getSnapshot().unknown) return;
    shared.update({ saving: true, unknown: false });
    try {
      await mutation.mutateAsync({ folderId: folder.memberFolderId, pinned: !folder.pinned });
    } catch (error) {
      if (error instanceof ApiError) {
        showToast('고정 상태 저장에 실패했습니다. 다시 시도해 주세요.', 'error');
      } else {
        // A transport error does not prove rollback: GET the authoritative server value.
        try {
          await recheck();
          showToast('저장 결과가 불명확해 서버 상태를 다시 확인했습니다.', 'info');
        } catch {
          shared.update({ unknown: true });
          showToast('서버 상태를 확인하지 못했습니다. 다시 확인해 주세요.', 'error');
        }
      }
    } finally {
      shared.update({ saving: false });
    }
  };
  const retryRead = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (shared.getSnapshot().saving) return;
    shared.update({ saving: true });
    try {
      await recheck();
      shared.update({ unknown: false });
    } catch { showToast('확인에 실패했습니다. 다시 시도해 주세요.', 'error'); }
    finally { shared.update({ saving: false }); }
  };
  return <span className="flex w-full flex-col">
    <button type="button" role={menuItem ? 'menuitem' : undefined} onClick={action} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    }} disabled={saving || unknown} aria-busy={saving}
      aria-label={folder.pinned ? 'Unpin folder' : 'Pin folder'}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium text-gray-700 dark:text-white hover:bg-purple-50 dark:hover:bg-purple-600/20 focus-visible:outline-2 focus-visible:outline-purple-500 focus-visible:-outline-offset-2 disabled:opacity-60">
      {saving ? <span className="material-symbols-outlined flex h-5 w-5 shrink-0 items-center justify-center animate-spin !text-[16px]" aria-hidden="true" aria-label="Saving">sync</span>
        : <PinIcon unpin={folder.pinned} />}
      <span>{saving ? '저장 중' : folder.pinned ? 'Unpin' : 'Pin'}</span>
    </button>
    {unknown && <button type="button" role={menuItem ? 'menuitem' : undefined} onClick={retryRead} disabled={saving} className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-white underline">다시 확인</button>}
  </span>;
}
