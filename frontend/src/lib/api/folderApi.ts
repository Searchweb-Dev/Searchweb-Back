import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchClient } from './fetchClient';
import type { FolderResponse, CreateFolderRequest, UpdateFolderRequest, MoveFolderRequest } from '@/lib/types/folder';


/**
 * 루트 폴더 목록을 백엔드에서 가져옵니다.
 * GET /api/folders/owners/{ownerMemberId}/root
 */
async function fetchRootFolders(ownerMemberId: number): Promise<FolderResponse[]> {
  return fetchClient<FolderResponse[]>(`/api/folders/owners/${ownerMemberId}/root`);
}

export function usePinnedFolders(ownerMemberId: number | undefined) {
  return useQuery({
    queryKey: ['folders', 'pinned', ownerMemberId],
    queryFn: () => fetchClient<FolderResponse[]>('/api/folders/me/pinned'),
    enabled: ownerMemberId != null,
  });
}

export function useSetFolderPinned(ownerMemberId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, pinned }: { folderId: number; pinned: boolean }) =>
      fetchClient<FolderResponse>(`/api/folders/${folderId}/pinned`, {
        method: 'PATCH', body: JSON.stringify({ pinned }),
      }),
    onSuccess: (confirmed) => {
      queryClient.setQueryData<FolderResponse[]>(['folders', 'root', ownerMemberId], old =>
        old?.map(folder => folder.memberFolderId === confirmed.memberFolderId ? confirmed : folder));
      queryClient.setQueryData<FolderResponse[]>(['folders', 'pinned', ownerMemberId], old => old &&
        (confirmed.pinned ? [...old.filter(f => f.memberFolderId !== confirmed.memberFolderId), confirmed]
          : old.filter(f => f.memberFolderId !== confirmed.memberFolderId)));
      queryClient.invalidateQueries({ queryKey: ['folders', 'root', ownerMemberId] });
      queryClient.invalidateQueries({ queryKey: ['folders', 'pinned', ownerMemberId] });
    },
  });
}

/**
 * 새로운 폴더를 생성합니다.
 * POST /api/folders
 */
async function createFolder(data: CreateFolderRequest): Promise<number> {
  return fetchClient<number>('/api/folders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 특정 폴더를 삭제합니다.
 * DELETE /api/folders/{folderId}
 */
async function deleteFolder(folderId: number): Promise<void> {
  return fetchClient<void>(`/api/folders/${folderId}`, {
    method: 'DELETE',
  });
}

/**
 * 폴더 정보를 수정합니다.
 * PUT /api/folders/{folderId}
 */
async function updateFolder({ folderId, data }: { folderId: number; data: UpdateFolderRequest }): Promise<void> {
  return fetchClient<void>(`/api/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 폴더 위치를 이동합니다.
 * PUT /api/folders/{folderId}/move
 */
async function moveFolder({ folderId, data }: { folderId: number; data: MoveFolderRequest }): Promise<void> {
  return fetchClient<void>(`/api/folders/${folderId}/move`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}


// ──────────────────────────────────────────────
// React Query Hooks (UI 연동)
// ──────────────────────────────────────────────

/**
 * [조회 Hook] 특정 사용자의 루트 폴더 목록을 가져옵니다.
 * @param ownerMemberId 사용자 ID
 */
export function useFolders(ownerMemberId: number | undefined) {
  return useQuery({
    queryKey: ['folders', 'root', ownerMemberId],
    queryFn: () => {
      if (ownerMemberId == null) throw new Error('Owner ID is required');
      return fetchRootFolders(ownerMemberId);
    },
    enabled: ownerMemberId != null,
  });
}

/**
 * [생성 Hook] 새로운 폴더를 생성합니다.
 * 성공 시 'folders' 캐시를 무효화하여 목록을 자동 갱신합니다.
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

/**
 * [삭제 Hook] 특정 폴더를 삭제합니다.
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

/**
 * [수정 Hook] 폴더 정보를 업데이트합니다.
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

/**
 * [이동 Hook] 폴더를 다른 위치로 이동합니다.
 */
export function useMoveFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: moveFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}


