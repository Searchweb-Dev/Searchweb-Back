'use client';

import { useUIStore } from '@/lib/store/uiStore';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useCreateFolder } from '@/lib/api/folderApi';
import { useAuthStore } from '@/lib/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/fetchClient';
import { showToast } from '@/lib/store/toastStore';

const COLORS = [
  { id: 'purple', base: 'bg-purple-500 hover:ring-purple-500', active: 'ring-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' },
  { id: 'blue', base: 'bg-blue-500 hover:ring-blue-500', active: 'ring-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' },
  { id: 'teal', base: 'bg-teal-500 hover:ring-teal-500', active: 'ring-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]' },
  { id: 'orange', base: 'bg-orange-500 hover:ring-orange-500', active: 'ring-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' },
  { id: 'pink', base: 'bg-pink-500 hover:ring-pink-500', active: 'ring-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' },
];

const ICONS = ['folder', 'work', 'school', 'star', 'rocket_launch'];

/**
 * 새 폴더 생성 다이얼로그 컴포넌트
 */
export function CreateFolderDialog() {
  // 전역 UI 상태 (다이얼로그 열림/닫힘)
  const { createFolderDialogOpen, toggleCreateFolderDialog } = useUIStore();

  // 로컬 상태 관리 (입력 폼 데이터)
  const [folderName, setFolderName] = useState('');             // 폴더 이름
  const [selectedIcon, setSelectedIcon] = useState('work');     // 선택된 아이콘 이름
  const [selectedColor, setSelectedColor] = useState('purple'); // 선택된 색상 ID
  const [isPinned, setIsPinned] = useState(false);
  // 결과 불명확 후 목록 재조회 중: mutation은 끝났지만 재제출 시 중복 생성 위험 (AC-12b)
  const [isVerifying, setIsVerifying] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(createFolderDialogOpen);
  // Reset before rendering a new open/closed session, including store-driven closes
  // that do not call Radix onOpenChange. Failed submissions leave open unchanged.
  if (previousOpen !== createFolderDialogOpen) {
    setPreviousOpen(createFolderDialogOpen);
    setIsPinned(false);
  }
  const memberId = useAuthStore((s) => s.member?.memberId);

  // 폴더 생성 API 연동 (React Query Mutation)
  const createFolderMutation = useCreateFolder();
  const queryClient = useQueryClient();


  /**
   * [핸들러] 폴더 생성 버튼 클릭 시 실행
   */
  const handleCreateFolder = () => {
    // 유효성 검사: 이름이 비어있으면 중단
    if (!folderName.trim() || !memberId || isVerifying) return;

    // API 호출
    createFolderMutation.mutate(
      {
        ownerMemberId: memberId,
        folderName: folderName.trim(),
        pinned: isPinned,
      },
      {
        // 성공 시 후처리
        onSuccess: () => {
          toggleCreateFolderDialog(false); // 창 닫기
          setFolderName('');               // 입력값 초기화
          setIsPinned(false);
        },
        // 실패 시 성공 표시 금지: 다이얼로그 유지 + 에러 토스트 (AC-01c/12a)
        onError: async (error) => {
          if (error instanceof ApiError) {
            showToast('폴더 생성에 실패했습니다. 다시 시도해 주세요.', 'error');
          } else {
            // 결과 불명확: 계정별 목록·pinned 재조회가 완료된 뒤 확인 요청 (AC-12b).
            setIsVerifying(true);
            try {
              await queryClient.invalidateQueries({ queryKey: ['folders'] }, { throwOnError: true });
              showToast('생성 결과가 불명확합니다. 새로 불러온 목록을 확인한 뒤 다시 시도해 주세요.', 'error');
            } catch {
              showToast('생성 결과와 목록을 확인하지 못했습니다. 연결 복구 후 다시 확인해 주세요.', 'error');
            } finally {
              setIsVerifying(false);
            }
          }
        },
      }
    );
  };

  return (
    <Dialog open={createFolderDialogOpen} onOpenChange={(open) => { if (!open) setIsPinned(false); toggleCreateFolderDialog(open); }}>
      <DialogContent className="max-tablet-lg:!top-auto max-tablet-lg:!bottom-0 max-tablet-lg:!translate-y-0 max-sm:!max-w-full sm:max-w-md max-tablet-lg:max-w-md max-sm:px-0 sm:px-4 max-tablet-lg:px-4 max-tablet-lg:!rounded-t-3xl max-sm:!rounded-b-none sm:rounded-[16px] max-tablet-lg:rounded-[16px] max-tablet-lg:border-x-0 max-tablet-lg:border-b-0 max-tablet-lg:pb-8 tablet-lg:max-w-md bg-white dark:bg-[#0a0a0b] tablet-lg:rounded-[16px] shadow-2xl p-0 overflow-hidden border border-gray-100 dark:border-white/[0.08] !gap-0 [&>button]:hidden max-tablet-lg:data-[state=open]:!slide-in-from-bottom-full max-tablet-lg:data-[state=closed]:!slide-out-to-bottom-full max-tablet-lg:data-[state=open]:!zoom-in-100 max-tablet-lg:data-[state=closed]:!zoom-out-100 duration-300">
        
        {/* Mobile Drag Handle Indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 tablet-lg:hidden bg-white dark:bg-[#0a0a0b]">
          <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>

        {/* 접근성을 위한 제목 (가독성을 위해 숨김 처리) */}
        <DialogTitle className="sr-only">Create New Folder</DialogTitle>

        <div className="p-6 pt-3 tablet-lg:pt-6">
          {/* 헤더 영역: 제목 및 닫기 버튼 */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_50%,#a78bfa_100%)] p-1.5 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white !text-[18px] fill-1">folder</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Folder</h3>
            </div>
            <button 
              onClick={() => toggleCreateFolderDialog(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* 1. 폴더 이름 입력 섹션 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <label htmlFor="folder-name-input" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Folder Name</label>
              </div>
              <input 
                id="folder-name-input"
                type="text"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder-gray-400" 
                placeholder="e.g., Design Resources"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>

            {/* 2. 외형 설정 (아이콘 선택) 섹션 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Appearance</label>
              </div>
              <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-[0.5px]">
                  <div className="px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-purple-500/30 shadow-lg shadow-purple-500/10 flex items-center gap-1.5 transform hover:scale-105 transition-transform duration-300">
                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 !text-[14px]">lock</span>
                    <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">Coming soon!</span>
                  </div>
                </div>
                
                {/* Content partially visible */}
                <div className="opacity-30 pointer-events-none select-none">
                  <p className="text-xs text-gray-500 mb-3 font-medium">Select Icon</p>
                  <div className="flex gap-2 mb-0 overflow-x-auto pt-1 pb-1">
                    {ICONS.map((iconStr) => {
                      const isActive = selectedIcon === iconStr;
                      return (
                        <div 
                          key={iconStr}
                          style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
                          className={`flex items-center justify-center rounded-lg transition-all shadow-sm flex-shrink-0 ${
                            isActive 
                              ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300' 
                              : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <span className="material-symbols-outlined !text-[18px] !leading-none">{iconStr}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 고정 및 색상 설정 섹션 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pin Settings</label>
              </div>
              <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Pin to Top</span>
                    <button type="button" role="switch" aria-label="Pin to Top" aria-checked={isPinned} onClick={() => setIsPinned(v => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full focus-visible:ring-2 focus-visible:ring-purple-500 ${isPinned ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`${isPinned ? 'translate-x-4' : 'translate-x-[2px]'} inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`}></span>
                    </button>
                  </div>
                  {/* 테마 색상 선택 (비활성) */}
                  <div className="opacity-30 pointer-events-none select-none">
                  {/* 테마 색상 선택 */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-3 font-medium">Select Color</p>
                    <div className="flex gap-3">
                      {COLORS.map((c) => (
                        <div
                          key={c.id}
                          className={`w-6 h-6 rounded-full flex-shrink-0 bg-gray-400 opacity-60`}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 푸터 영역: 취소 및 생성 완료 버튼 */}
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end items-center gap-4 border-t border-gray-100 dark:border-gray-700">
          <button 
            type="button"
            onClick={() => toggleCreateFolderDialog(false)}
            className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors max-tablet-lg:hidden"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={!folderName.trim() || createFolderMutation.isPending || isVerifying} // 이름이 없거나 생성·결과 재조회 중이면 비활성화
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed max-tablet-lg:w-full max-tablet-lg:text-center max-tablet-lg:py-3.5 max-tablet-lg:text-[15px]"
          >
            {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
