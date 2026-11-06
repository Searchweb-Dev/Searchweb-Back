'use client';

import { FolderCard } from '@/components/my-links/FolderCard';
import { PinnedFolderCard } from '@/components/my-links/PinnedFolderCard';
import { RightPanel } from '@/components/my-links/RightPanel';
import { useUIStore } from '@/lib/store/uiStore';
import { useStore } from '@/lib/hooks/useStore';
import { useFolders, usePinnedFolders } from '@/lib/api/folderApi';
import { useFolderStore, type SearchScope } from '@/lib/store/folderStore';
import { useAuthStore } from '@/lib/store/authStore';
import { SortDropdown, SortOption } from '@/components/ui/SortDropdown';
import { useBookmarks } from '@/lib/api/bookmarkApi';
import { useLinkStore } from '@/lib/store/linkStore';
import { FOLDER_TYPE, type FolderResponse } from '@/lib/types/folder';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { compareFolders } from '@/lib/utils/folderUtils';
import { myFolderHiddenIds, withoutPinned } from '@/lib/utils/pinnedDisplay';
import { useFlipLayout } from '@/lib/hooks/useFlipLayout';
import { usePinnedScrollArea } from '@/lib/hooks/usePinnedScrollArea';
import { pinnedAreaMaxHeight } from '@/lib/utils/pinnedScroll';
import { ANALYTICS_EVENTS, trackEvent } from '@/lib/analytics';

export default function MyLinksPage() {
  const { toggleRightPanel, toggleSaveLinkDialog, saveLinkDialogOpen, setPanelMode } = useUIStore();
  const persistedPanelMode = useStore(useUIStore, (s) => s.panelMode);
  const panelMode = persistedPanelMode ?? 'drawer';
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [shouldRenderTooltip, setShouldRenderTooltip] = useState(false);

  useEffect(() => {
    const checkClipboard = async () => {
      if (saveLinkDialogOpen) {
        setClipboardUrl(null);
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          setClipboardUrl(text);
        }
      } catch (err) {
        console.warn('Clipboard read error:', err);
      }
    };

    checkClipboard();

    window.addEventListener('focus', checkClipboard);
    return () => {
      window.removeEventListener('focus', checkClipboard);
    };
  }, [saveLinkDialogOpen]);

  useEffect(() => {
    let fadeInTimer: NodeJS.Timeout;
    let fadeOutTimer: NodeJS.Timeout;
    let clearTimer: NodeJS.Timeout;

    if (clipboardUrl) {
      setShouldRenderTooltip(true);

      fadeInTimer = setTimeout(() => {
        setIsTooltipVisible(true);
      }, 50);

      fadeOutTimer = setTimeout(() => {
        setIsTooltipVisible(false);
      }, 30000);

      clearTimer = setTimeout(() => {
        setShouldRenderTooltip(false);
        setClipboardUrl(null);
      }, 31000);
    } else {
      setIsTooltipVisible(false);
      setShouldRenderTooltip(false);
    }

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(clearTimer);
    };
  }, [clipboardUrl]);
  const setSelectedFolderId = useFolderStore((s) => s.setSelectedFolderId);
  const selectedFolderId = useFolderStore((s) => s.selectedFolderId);           // 현재 선택된 폴더 ID
  const searchQuery = useFolderStore((s) => s.searchQuery);           // 폴더 검색어 상태
  const setSearchQuery = useFolderStore((s) => s.setSearchQuery);     // 폴더 검색어 변경 함수
  const searchScope = useFolderStore((s) => s.searchScope);           // 검색 범위 ('folders' | 'all')
  const setSearchScope = useFolderStore((s) => s.setSearchScope);     // 검색 범위 변경 함수
  const savedTodayFilter = useFolderStore((s) => s.savedTodayFilter); // '오늘 저장' 필터 상태
  const toggleSavedTodayFilter = useFolderStore((s) => s.toggleSavedTodayFilter); // 필터 토글 함수
  const unreadFilter = useFolderStore((s) => s.unreadFilter);         // 'Unread' 필터 상태 (view_count = 0)
  const toggleUnreadFilter = useFolderStore((s) => s.toggleUnreadFilter); // Unread 필터 토글 함수
  const unorganizedFilter = useFolderStore((s) => s.unorganizedFilter); // 미분류 필터 상태
  const toggleUnorganizedFilter = useFolderStore((s) => s.toggleUnorganizedFilter); // 미분류 필터 토글 함수
  const memberId = useAuthStore((s) => s.member?.memberId);           // 로그인된 사용자 ID
  const isAuthInitializing = useAuthStore((s) => s.isInitializing);   // 인증 세션 복구 중 여부

  // 검색어 디바운스 처리를 위한 로컬 상태
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  // KPI: 검색 완료 시점을 정확히 파악하여 트래킹하기 위한 분석용 임시 대기열 레퍼런스
  const pendingSearchAnalyticsRef = useRef<{
    query: string;
    searchScope: SearchScope;
  } | null>(null);

  // 외부(스토어)에서 검색어가 직접 변경될 경우(예: 초기화 버튼) 로컬 상태와 동기화
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // 디바운스 로직: localSearchQuery가 변경되면 250ms 후에 스토어 업데이트
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        const trimmedQuery = localSearchQuery.trim();
        // KPI: 타이핑이 끝났을 때 분석 대기열에 검색어 조건 임시 저장
        pendingSearchAnalyticsRef.current = trimmedQuery
          ? { query: trimmedQuery, searchScope }
          : null;
        setSearchQuery(localSearchQuery);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [localSearchQuery, searchQuery, searchScope, setSearchQuery]);

  // CSS 변수에서 tablet-lg 브레이크포인트를 읽어 px 값으로 변환합니다.
  // globals.css의 --breakpoint-tablet-lg 값과 항상 동기화됩니다.
  useEffect(() => {
    const getTabletLgBreakpoint = (): number => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--breakpoint-tablet-lg')
        .trim(); // e.g. "87.5rem"
      const remValue = parseFloat(raw); // 87.5
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize); // 보통 16px
      return remValue * rootFontSize; // 1400px
    };

    const handleResize = () => {
      const breakpoint = getTabletLgBreakpoint();
      const isDesktop = window.innerWidth >= breakpoint;
      const currentPanelState = useUIStore.getState().rightPanelOpen;
      const currentPanelMode = useUIStore.getState().panelMode;
      
      // 고정 모드(fixed)일 때만 데스크톱에서 기본 열림 처리
      if (currentPanelMode === 'fixed') {
        if (isDesktop && !currentPanelState) {
          toggleRightPanel(true);
        } else if (!isDesktop && currentPanelState) {
          toggleRightPanel(false);
        }
      }
    };

    // 초기 실행
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [toggleRightPanel]);

  const { data: folders, isLoading: isFoldersLoading, error, refetch: refetchFolders } = useFolders(memberId); // 전체 폴더 목록 조회
  const { data: serverPinned, isLoading: isPinnedLoading, error: pinnedError, refetch: refetchPinned } = usePinnedFolders(memberId);

  // 인증 또는 폴더 로딩 중
  const isLoading = isAuthInitializing || isFoldersLoading;
  const isPopupMode = panelMode === 'drawer';

  // TODO: 하위 폴더(Subfolder) 기능 도입 시, 루트 폴더 단순 reduce 합산은 하위 폴더의 북마크를 누락하여 과소 집계(underreport)될 수 있음.
  // 추후 하위 폴더 구현 시 전체 북마크 응답(useBookmarks totalCount) 또는 집계 API 응답값 기반으로 totalLinkCount 산출 방식 변경 필요.
  const totalLinkCount = useMemo(() => (folders ?? []).reduce((total, folder) => total + folder.bookmarkCount, 0), [folders]);
  const allLinksFolder: FolderResponse = useMemo(() => ({
    memberFolderId: -1,
    ownerMemberId: memberId || 0,
    parentFolderId: null,
    folderName: 'All Links',
    description: 'All Links',
    bookmarkCount: totalLinkCount,
    folderType: FOLDER_TYPE.CUSTOM,
    pinned: false,
    createdAt: '',
    updatedAt: ''
  }), [totalLinkCount, memberId]);

  const [folderSort, setFolderSort] = useState('recently');
  const folderSortOptions: SortOption[] = [
    { id: 'recently', label: 'Recently Added', icon: 'schedule' },
    { id: 'a-z', label: 'Name (A-Z)', icon: 'sort_by_alpha' },
    { id: 'count', label: 'Link Count', icon: 'list_alt' }
  ];

  const scopeOptions: SortOption[] = [
    { id: 'all', label: 'All', icon: 'filter_alt' },
    { id: 'folders', label: 'Folders', icon: 'folder' },
    { id: 'links', label: 'Links', icon: 'link' },
  ];

  // 상단 고정 폴더 배지 클릭 처리
  const handleFolderBadgeClick = (folder: FolderResponse) => {
    const folderId = folder.memberFolderId;
    const currentSelectedId = useFolderStore.getState().selectedFolderId;
    if (currentSelectedId === folderId) {
      setSelectedFolderId(null);
    } else {
      setSelectedFolderId(folderId); // 선택된 폴더 변경
      
      // KPI: 폴더 탐색(클릭) 이벤트 전송 (해당 폴더 내부 북마크 개수 포함)
      trackEvent(ANALYTICS_EVENTS.FOLDER_CLICK, {
        event_params: {
          result_count: folder.bookmarkCount,
        }
      });
      
      // 선택 시에만 수행: 현재 폴더 검색어를 링크 검색어로 동기화
      if (searchQuery) {
        useLinkStore.getState().setSearchQuery(searchQuery);
      }
      
      // 선택 시에만 수행: 우측 패널 열기
      toggleRightPanel(true);
    }
  };

  // 검색 범위가 '전체' 또는 '링크'로 변경될 때 폴더 선택 해제
  useEffect(() => {
    if (searchScope === 'all' || searchScope === 'links') {
      setSelectedFolderId(null);
    }
  }, [searchScope, setSelectedFolderId]);

  // 검색어 동기화: 검색 범위가 '전체' 또는 '링크'일 때만 링크 스토어와 검색어 연동
  useEffect(() => {
    if (searchScope === 'all' || searchScope === 'links') {
      const currentLinkQuery = useLinkStore.getState().filters.searchQuery;
      if (currentLinkQuery !== searchQuery) {
        useLinkStore.getState().setSearchQuery(searchQuery);
      }
    }
  }, [searchQuery, searchScope]);

  // 검색 필터링 로직
  const isSearching = searchQuery.trim().length > 0;

  // 미분류 폴더 ID 찾기
  const unorganizedFolder = folders?.find(f => f.folderType === FOLDER_TYPE.UNORGANIZED);
  const unorganizedFolderId = unorganizedFolder?.memberFolderId;

  // Pinned selection is server-owned; display current names/counts from the same root entities.
  const pinnedFolders = useMemo(() => {
    if (!serverPinned || !folders) return [];
    const current = new Map(folders.map(folder => [folder.memberFolderId, folder]));
    return serverPinned.map(confirmed => ({ ...current.get(confirmed.memberFolderId), ...confirmed,
      // Prefer the current root entity for the displayed name/count, but GET pinned owns membership.
      folderName: current.get(confirmed.memberFolderId)?.folderName ?? confirmed.folderName,
      bookmarkCount: current.get(confirmed.memberFolderId)?.bookmarkCount ?? confirmed.bookmarkCount,
      pinned: true,
    })).sort((a, b) => compareFolders(a, b, folderSort));
  }, [serverPinned, folders, folderSort]);
  const pinnedSectionState = isAuthInitializing || isFoldersLoading || isPinnedLoading ? 'loading'
    : error || pinnedError ? 'error' : 'ready';
  // Single exposure: a folder rendered in Pinned is hidden from My Folder (display only).
  const hiddenFromMyFolder = useMemo(() => myFolderHiddenIds(pinnedSectionState, pinnedFolders, folders),
    [pinnedSectionState, pinnedFolders, folders]);
  const flipRootRef = useRef<HTMLDivElement>(null);
  useFlipLayout(flipRootRef);
  const pinnedScrollRef = useRef<HTMLDivElement>(null);
  const onPinnedAreaFocus = usePinnedScrollArea(pinnedScrollRef);

  // 북마크 데이터 조회 조건 결정:
  // 1. 전체 또는 링크 범위 검색 중이거나
  // 2. 오늘 저장 필터가 활성화된 경우
  // 3. Unread 필터가 활성화된 경우
  // 4. 미분류 필터가 활성화된 경우 서버에서 북마크 정보를 가져옴
  // 단, 미분류 필터가 활성화되었지만 아직 폴더 정보(unorganizedFolderId)를 불러오지 못한 경우 요청을 보류합니다.
  const shouldFetchBookmarks = 
    ((searchScope === 'all' || searchScope === 'links') && isSearching) || 
    savedTodayFilter || 
    unreadFilter || 
    (unorganizedFilter && unorganizedFolderId != null);
    
  const bookmarkParams: Parameters<typeof useBookmarks>[0] = {};
  if (isSearching && (searchScope === 'all' || searchScope === 'links')) bookmarkParams.query = searchQuery;
  if (unreadFilter) bookmarkParams.unreadOnly = true;
  if (savedTodayFilter) bookmarkParams.savedTodayOnly = true;
  if (unorganizedFilter && unorganizedFolderId) bookmarkParams.folderId = unorganizedFolderId;
  const {
    data: allBookmarks,
    isFetching: isSearchFetching,
    isError: isSearchError,
  } = useBookmarks(
    bookmarkParams,
    { enabled: shouldFetchBookmarks }
  );

  // 북마크 데이터로부터 필터링에 필요한 ID 집합(Set) 추출 (O(N))
  // matchingFolderIdsSet은 백엔드에서 정확하게 필터링된 폴더들
  const matchingFolderIdsSet = new Set(allBookmarks?.matchingFolderIds ?? []);

  // --- Folder Logic (Filtering & Sorting) ---

  // 1. 검색/필터링 결과 폴더 목록 메모이제이션
  const processedSearchResultFolders = useMemo(() => {
    if (!folders) return [];
    const visibleFolders = withoutPinned(folders, hiddenFromMyFolder);
    
    // 필터링 로직 수행
    let filtered = isSearching
      ? visibleFolders.filter((folder) => {
          const queryLower = searchQuery.toLowerCase();
          
          // 검색 범위에 따른 매칭 확인
          const matchFolderName = (searchScope === 'all' || searchScope === 'folders') 
            && folder.folderName.toLowerCase().includes(queryLower);
            
          const matchBookmark = (searchScope === 'all' || searchScope === 'links') 
            && matchingFolderIdsSet.has(folder.memberFolderId);
            
          return matchFolderName || matchBookmark;
        })
      : [...visibleFolders];

    // 추가 필터링 (오늘 저장, 안 읽음, 미분류)
    if (savedTodayFilter) {
      filtered = filtered.filter((f) => matchingFolderIdsSet.has(f.memberFolderId));
    }
    if (unreadFilter) {
      filtered = filtered.filter((f) => matchingFolderIdsSet.has(f.memberFolderId));
    }
    if (unorganizedFilter) {
      filtered = filtered.filter((f) => f.folderType === FOLDER_TYPE.UNORGANIZED);
    }

    // 최종 정렬 적용
    return [...filtered].sort((a, b) => compareFolders(a, b, folderSort));
  }, [folders, hiddenFromMyFolder, isSearching, searchQuery, searchScope, matchingFolderIdsSet, savedTodayFilter, unreadFilter, unorganizedFilter, folderSort]);

  // 2. 대시보드용 My Folder 목록 메모이제이션 (고정 폴더 제외 + 기존 정렬)
  const processedAllFolders = useMemo(() => {
    return withoutPinned(folders ?? [], hiddenFromMyFolder).slice().sort((a, b) => compareFolders(a, b, folderSort));
  }, [folders, hiddenFromMyFolder, folderSort]);

  const searchResultFolderCount = processedSearchResultFolders.length;
  const matchedLinksCount = allBookmarks?.bookmarks?.length ?? 0;
  const searchResultCount = searchScope === 'folders'
    ? searchResultFolderCount
    : searchScope === 'links'
      ? allBookmarks?.totalCount ?? 0
      : searchResultFolderCount + (allBookmarks?.totalCount ?? 0);

  // KPI: 검색 완료 시점 및 검색 결과 통계(이벤트) 기록을 위한 이펙트 (분석 전용 2초 디바운스 적용)
  useEffect(() => {
    const pendingSearch = pendingSearchAnalyticsRef.current;
    const trimmedQuery = searchQuery.trim();

    // 검색 통계 수집 조건 판정 예외처리: 타이핑 중이거나, 로딩 중이거나, 에러 발생 시에는 전송 보류
    if (
      !pendingSearch ||
      !trimmedQuery ||
      pendingSearch.query !== trimmedQuery ||
      pendingSearch.searchScope !== searchScope ||
      isSearchFetching ||
      isSearchError
    ) {
      return;
    }

    // 서버 응답이 최종 완료된 후, 2초(2000ms) 동안 추가 검색어 변경이 없을 때만 이벤트 전송 (중간 오염 데이터 방지)
    const analyticsTimer = setTimeout(() => {
      trackEvent(ANALYTICS_EVENTS.SEARCH, {
        event_params: {
          search_scope: searchScope,
          query_length: trimmedQuery.length,
          result_count: searchResultCount,
        }
      });
      // 이벤트 전송 완료 후 대기열 초기화
      pendingSearchAnalyticsRef.current = null;
    }, 2000);

    return () => {
      clearTimeout(analyticsTimer);
    };
  }, [
    searchQuery,
    searchScope,
    searchResultCount,
    isSearchFetching,
    isSearchError,
  ]);

  // 헤더 메시지 생성
  let headerLabel = '';
  if (unorganizedFilter) {
    headerLabel = `Unorganized: ${searchResultFolderCount} folders found`;
  } else if (unreadFilter) {
    headerLabel = `Unread: ${searchResultFolderCount} folders found`;
  } else if (savedTodayFilter) {
    headerLabel = `Saved Today: ${searchResultFolderCount} folders found`;
  } else if (searchScope === 'all') {
    headerLabel = `${searchResultFolderCount} folders & ${matchedLinksCount} links found`;
  } else if (searchScope === 'links') {
    headerLabel = `${matchedLinksCount} links found in ${searchResultFolderCount} folders`;
  } else {
    headerLabel = `${searchResultFolderCount} folders found`;
  }

  // 필터 또는 검색 활성화 시 결과 표시
  // 대시보드 대신 검색 결과 화면을 보여줄지 여부 (검색 중이거나 필터 활성화 시)
  const isShowingFiltered = isSearching || savedTodayFilter || unreadFilter || unorganizedFilter;
  const emptyFilteredMessage = (() => {
    if (unreadFilter && savedTodayFilter) return 'No unread links saved today';
    if (unorganizedFilter && savedTodayFilter) return 'No unorganized links saved today';
    if (unreadFilter) return 'No unread links';
    if (savedTodayFilter) return 'No links saved today';
    if (unorganizedFilter) return 'No unorganized links';
    if (isSearching) return 'No results match your search';
    return 'No matching folders';
  })();

  const PINNED_COLORS = [
    'bg-gradient-to-br from-indigo-500 to-purple-600',
    'bg-gradient-to-br from-blue-500 to-cyan-500',
    'bg-gradient-to-br from-emerald-500 to-teal-600',
    'bg-gradient-to-br from-rose-500 to-pink-600',
    'bg-gradient-to-br from-amber-500 to-orange-600',
    'bg-gradient-to-br from-violet-500 to-fuchsia-600'
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main Content Area */}
      <div className={cn(
        "flex-1 min-w-0 overflow-y-auto px-6 py-2 pb-28 tablet-lg:px-10 tablet-lg:py-3 tablet-lg:pb-4 transition-colors duration-300 bg-[#fafafa] dark:bg-white/[0.04]",
        isPopupMode && "px-8 py-4 pb-28 tablet-lg:px-12 tablet-lg:py-5 tablet-lg:pb-8 xl:px-20 2xl:px-28"
      )}>
        {/* [분기 1] 팝업 모드일 때 검색바, 태그 필터, 메인 폴더 목록 전체를 단 하나의 통합 메인 카드 영역으로 감쌈 */}
        <div ref={flipRootRef} className={cn(
          "w-full transition-all duration-300",
          isPopupMode ? "max-w-[1080px] mx-auto min-h-full" : "max-w-[1400px]"
        )}>
          
          {/* Top Search & Filter Section */}
        <div className="mb-5 flex flex-col items-start bg-transparent">
          
          <div className={cn("relative w-full max-w-md mb-3", isPopupMode && "mb-3 max-w-[460px]")}>
            <div className="group bg-white dark:bg-gray-900 rounded-full flex items-center p-1 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300">
              <div className="pl-3 pr-2 text-gray-400 dark:text-gray-500 group-focus-within:text-gray-600 dark:group-focus-within:text-gray-300 transition-colors flex items-center">
                <span className="material-symbols-outlined text-[18px]">search</span>
              </div>
              <input 
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-xs py-1.5 px-1 text-gray-800 dark:text-gray-100 placeholder-gray-400 font-normal" 
                placeholder="Search folders or links" 
                type="text"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
              />
              
              {/* Search Scope Toggle Dropdown using common component */}
              <SortDropdown 
                value={searchScope}
                onChange={(val) => {
                  const nextScope = val as SearchScope;
                  const trimmedQuery = localSearchQuery.trim();
                  pendingSearchAnalyticsRef.current = trimmedQuery
                    ? { query: trimmedQuery, searchScope: nextScope }
                    : null;
                  setSearchScope(nextScope);
                }}
                options={scopeOptions}
                className="shrink-0 mr-1 ml-1"
                panelClassName="w-28 right-[-12px]"
                align="right"
                renderTrigger={({ selectedOption, isOpen, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200",
                      isOpen && "bg-gray-100 dark:bg-gray-800 text-purple-500 dark:text-purple-400"
                    )}
                    title="Search Filter"
                  >
                    <span className="material-symbols-outlined !text-[16px]">
                      {selectedOption?.icon || 'filter_alt'}
                    </span>
                  </button>
                )}
              />

              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => {
                    pendingSearchAnalyticsRef.current = null;
                    setSearchQuery('');
                  }}
                  className="group/close flex items-center justify-center h-[18px] w-[18px] aspect-square bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full transition-all duration-200 mr-1.5 shrink-0"
                >
                  <svg 
                    className="w-2.5 h-2.5 transition-transform duration-200 group-hover/close:rotate-90" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1 pb-1 pl-1">
            <button type="button" className="flex items-center justify-center gap-1 px-2 py-0.5 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 rounded-full text-[9px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm">
              <span className="material-symbols-outlined !text-[12px]">tune</span> Filter
            </button>
            <div className="h-2.5 w-px bg-gray-300 dark:bg-gray-700 mx-0.5"></div>
            <button
              type="button"
              onClick={toggleUnorganizedFilter}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-medium transition-colors shadow-sm border ${
                unorganizedFilter
                  ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-600 text-rose-700 dark:text-rose-300'
                  : 'bg-white dark:bg-card-dark border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined !text-[12px] text-rose-400">inventory_2</span> Unorganized
            </button>
            <button
              type="button"
              onClick={toggleUnreadFilter}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-medium transition-colors shadow-sm border ${
                unreadFilter
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-card-dark border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined !text-[12px] text-blue-500">mark_email_unread</span> Unread
            </button>
            <button
              type="button"
              onClick={toggleSavedTodayFilter}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-medium transition-colors shadow-sm border ${
                savedTodayFilter
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-card-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className={`material-symbols-outlined !text-[12px] ${savedTodayFilter ? 'text-emerald-500' : 'text-green-500'}`}>today</span> Saved today
            </button>
          </div>
        </div>

        {/* 검색/필터와 무관하게 서버에서 확정된 고정 폴더를 표시 */}
        <section className={cn(isPopupMode ? 'mb-5' : 'mb-10 sm:mb-5')} aria-label="Pinned folders">
          <h2 className="text-xs font-bold text-gray-800 dark:text-gray-100 ml-1 mb-2">Pinned</h2>
          {pinnedSectionState === 'loading' ? (
            <div role="status" className="text-xs text-gray-500">고정 폴더를 불러오는 중...</div>
          ) : pinnedSectionState === 'error' ? (
            <div role="alert" className="text-xs text-rose-500">고정 폴더를 불러오지 못했습니다.
              <button type="button" onClick={() => { refetchFolders(); refetchPinned(); }} className="ml-2 underline">다시 시도</button>
            </div>
          ) : pinnedFolders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-xs text-gray-500">자주 찾는 폴더를 고정해보세요 📌</div>
          ) : (
            // Max two card rows; from the third row on the list scrolls inside this area only.
            // -m-1/p-1: ring/shadow room at the scroll edge without shifting the layout.
            <div ref={pinnedScrollRef} onFocus={onPinnedAreaFocus} data-pinned-scroll="" data-flip-clip=""
              role="group" aria-label="Pinned folder list" style={{ maxHeight: pinnedAreaMaxHeight(isPopupMode) }}
              className="-m-1 overflow-y-auto overflow-x-hidden p-1 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] dark:[scrollbar-color:#4B5563_transparent]">
              <div className="flex flex-wrap gap-2">
                {pinnedFolders.map((folder, idx) => (
                  <PinnedFolderCard key={folder.memberFolderId} folder={folder} flipId={folder.memberFolderId}
                    color={PINNED_COLORS[idx % PINNED_COLORS.length]} popup={isPopupMode}
                    onOpen={() => handleFolderBadgeClick(folder)} />
                ))}
              </div>
            </div>
          )}
        </section>
        {/* 검색어 있음 또는 필터 활성화: 폴더 카드 그리드로 검색 결과 표시 */}
        {isShowingFiltered && (
          <div>
            <div className="mb-4 ml-1">
              <h2 className="text-xs font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-purple-500">search</span>
                {headerLabel}
              </h2>
            </div>
            
            <div role="group" aria-label="Folder search results" className={cn("grid grid-cols-2 md:grid-cols-3 gap-2", isPopupMode ? "tablet-lg:grid-cols-5 xl:grid-cols-6" : "lg:grid-cols-3")}>
              {searchResultFolderCount === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 bg-white/40 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                  <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-700 mb-2">search_off</span>
                  <span className="text-xs text-gray-400 font-medium">{emptyFilteredMessage}</span>
                </div>
              ) : (
                processedSearchResultFolders.map((folder) => (
                  <div key={folder.memberFolderId} data-flip-id={folder.memberFolderId} data-flip-list="MF">
                    <FolderCard folder={folder} variant={isPopupMode ? 'popup' : 'default'} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 검색어 없음 & 필터 미활성화: 기존 대시보드 */}
        {!isShowingFiltered && (
          <>

            <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 mb-3 ml-1 relative z-30", isPopupMode && "mb-3")}>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-gray-800 dark:text-gray-100">My Folder</h2>

                {/* [분기 2] 패널 표시 방식 변경 스위처 (Popup: 폴더 클릭 시 팝업 모드 vs Fixed: 우측 상시 고정 모드) */}
                <div className="hidden tablet-lg:flex items-center bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg border border-gray-200/80 dark:border-gray-700/60 ml-1">
                  {/* Popup 모드 버튼 (panelMode === 'drawer' 일 때 보라색 활성화 스타일 적용) */}
                  <button
                    type="button"
                    onClick={() => {
                      setPanelMode('drawer');
                      toggleRightPanel(false);
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[9.5px] font-semibold rounded-md flex items-center gap-1 transition-all duration-200",
                      panelMode === 'drawer'
                        ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-xs"
                        : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    )}
                    title="폴더 클릭 시 팝업(드로어) 모드"
                  >
                    <span className="material-symbols-outlined !text-[13px]">dock_to_left</span>
                    <span>Popup</span>
                  </button>
                  {/* Fixed 모드 버튼 (panelMode === 'fixed' 일 때 보라색 활성화 스타일 적용) */}
                  <button
                    type="button"
                    onClick={() => {
                      setPanelMode('fixed');
                      toggleRightPanel(true);
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[9.5px] font-semibold rounded-md flex items-center gap-1 transition-all duration-200",
                      panelMode === 'fixed'
                        ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-xs"
                        : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    )}
                    title="우측 패널 상시 고정 모드"
                  >
                    <span className="material-symbols-outlined !text-[13px]">vertical_split</span>
                    <span>Fixed</span>
                  </button>
                </div>
              </div>
              
              <div className="flex items-center flex-wrap gap-1.5 focus-within:z-20 relative w-full sm:w-auto justify-start sm:justify-end">
                <SortDropdown 
                  value={folderSort}
                  onChange={setFolderSort}
                  options={folderSortOptions}
                  align="right"
                  panelClassName="right-[-8px] bg-white/78 border-white/70 ring-1 ring-slate-200/60 backdrop-blur-xl shadow-[0_20px_45px_-18px_rgba(15,23,42,0.22),0_12px_24px_-16px_rgba(148,163,184,0.45)] dark:ring-0 dark:backdrop-blur-md"
                />
                <button 
                  type="button"
                  onClick={() => useUIStore.getState().toggleCreateFolderDialog(true)}
                  className="hidden tablet-lg:flex group items-center gap-1 px-2 py-1 border border-gray-200/80 dark:border-white/8 rounded-md text-[10px] font-medium transition-all duration-200 bg-white/50 dark:bg-slate-900/50 text-gray-600 dark:text-white hover:bg-purple-50/50 dark:hover:bg-purple-900/20 hover:border-purple-200/50 dark:hover:border-purple-300/50"
                >
                  <span className="material-symbols-outlined !text-[12px] text-gray-400 dark:text-gray-500 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors leading-none">folder</span>
                  <span>Create Folder</span>
                </button>
                <div className="relative hidden tablet-lg:block z-50">
                  {shouldRenderTooltip && clipboardUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleSaveLinkDialog(true, clipboardUrl);
                        setClipboardUrl(null);
                      }}
                      className={`absolute -top-14 right-[-8px] z-50 group outline-none transition-all duration-1000 ease-in-out ${
                        isTooltipVisible 
                          ? 'opacity-100 translate-y-0 scale-100' 
                          : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                      }`}
                    >
                      <div className="relative w-[164px] h-[38px] flex items-center justify-center active:scale-95 transition-transform duration-150">
                        {/* Background Unified SVG Speech Bubble */}
                        <svg 
                          className="absolute -top-[2px] -left-[2px] w-[168px] h-[49px] drop-shadow-[0_12px_36px_rgba(124,58,237,0.3)] dark:drop-shadow-[0_12px_36px_rgba(0,0,0,0.6)] pointer-events-none" 
                          viewBox="-2 -2 168 49" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {/* Solid Fill */}
                          <path 
                            d="M 19 0 L 145 0 A 19 19 0 0 1 164 19 A 19 19 0 0 1 145 38 L 125 38 C 120.5 38 118 39.5 116 45 C 114 39.5 111.5 38 107 38 L 19 38 A 19 19 0 0 1 0 19 A 19 19 0 0 1 19 0 Z" 
                            className="fill-white dark:fill-[#0a0a0b] group-hover:fill-violet-50 dark:group-hover:fill-[#1c142c] transition-colors duration-300"
                          />
                          {/* Consistent Outer Border */}
                          <path 
                            d="M 19 0 L 145 0 A 19 19 0 0 1 164 19 A 19 19 0 0 1 145 38 L 125 38 C 120.5 38 118 39.5 116 45 C 114 39.5 111.5 38 107 38 L 19 38 A 19 19 0 0 1 0 19 A 19 19 0 0 1 19 0 Z" 
                            className="stroke-violet-200 dark:stroke-[#252528] transition-colors duration-300" 
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                        </svg>

                        {/* Speech Bubble Content */}
                        <div className="relative z-10 flex items-center gap-2 pl-3.5 pr-4.5">
                          <div className="relative bg-[linear-gradient(135deg,#7c3aed_0%,#a855f7_100%)] w-5 h-5 rounded-full flex items-center justify-center flex-none overflow-hidden">
                            <span className="inline-flex h-full w-full items-center justify-center rotate-[-45deg]">
                              <span className="material-symbols-outlined !text-[12px] !leading-none block text-white font-bold">link</span>
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-gray-50 tracking-tight pr-0.5 animate-pulse">Paste copied link</span>
                        </div>
                      </div>
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      toggleSaveLinkDialog(true, clipboardUrl || undefined);
                      if (clipboardUrl) setClipboardUrl(null);
                    }}
                    className="flex items-center space-x-1 text-[10px] font-bold text-white bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_50%,#a78bfa_100%)] hover:opacity-90 border-none rounded-md px-2.5 py-1 transition-all shadow-md shadow-purple-500/20 hover:scale-[1.02]"
                  >
                    <span className="material-symbols-outlined !text-[12px] !leading-none">add</span>
                    <span>Save Link</span>
                  </button>
                </div>
              </div>
            </div>

            <div role="group" aria-label="My Folder list" className={cn("grid grid-cols-2 gap-2 md:grid-cols-3", isPopupMode ? "tablet-lg:grid-cols-5 xl:grid-cols-6" : "lg:grid-cols-3")}>
              {/* ── 로딩 상태 ── */}
              {isLoading && (
                <div className="col-span-full flex items-center justify-center py-8">
                  <span className="material-symbols-outlined animate-spin text-2xl text-purple-500">sync</span>
                </div>
              )}

              {/* ── 에러 상태 ── */}
              {error && (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-rose-500">
                  <span className="material-symbols-outlined text-3xl mb-1">error_outline</span>
                  <span className="text-xs font-medium">폴더 목록을 불러오지 못했습니다</span>
                </div>
              )}

              {/* ── 데이터 조회가 성공한 경우에만 All Links 및 일반 폴더 카드 렌더링 ── */}
              {!isLoading && !error && folders && (
                <>
                  <div key="all-links" data-flip-id="-1" data-flip-list="MF">
                    <FolderCard folder={allLinksFolder} variant={isPopupMode ? 'popup' : 'default'} />
                  </div>

                  {/* ── 폴더 카드 목록 (고정 폴더는 Pinned에만 표시: 단일 노출) ── */}
                  {processedAllFolders.map((folder) => (
                    <div key={folder.memberFolderId} data-flip-id={folder.memberFolderId} data-flip-list="MF">
                      <FolderCard folder={folder} variant={isPopupMode ? 'popup' : 'default'} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Right Drawer/Panel Container */}
      <RightPanel />
    </div>
  );
}
