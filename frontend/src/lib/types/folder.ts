// 공통 ApiResponse는 apiResponse.ts에서 관리, 호환성을 위해 re-export
export type { ApiResponse } from './apiResponse';

// 백엔드 MemberFolderResponses DTO 대응
export const FOLDER_TYPE = {
  CUSTOM: 'CUSTOM',
  UNORGANIZED: 'UNORGANIZED',
} as const;

export type FolderType = typeof FOLDER_TYPE[keyof typeof FOLDER_TYPE];

export interface FolderResponse {
  memberFolderId: number;
  ownerMemberId: number;
  parentFolderId: number | null;
  folderName: string;
  description: string | null;
  folderType: FolderType;
  bookmarkCount: number;
  pinned: boolean;
}

// POST /api/folders 요청 바디
export interface CreateFolderRequest {
  ownerMemberId: number;
  parentFolderId?: number | null;
  folderName: string;
  description?: string;
  pinned?: boolean;
}

// PUT /api/folders/{folderId} 요청 바디
export interface UpdateFolderRequest {
  folderName: string;
  description?: string;
}

// PUT /api/folders/{folderId}/move 요청 바디
export interface MoveFolderRequest {
  newParentFolderId: number | null;
}
