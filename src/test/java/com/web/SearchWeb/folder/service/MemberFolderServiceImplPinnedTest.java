package com.web.SearchWeb.folder.service;

import com.web.SearchWeb.bookmark.dao.BookmarkDao;
import com.web.SearchWeb.folder.dao.MemberFolderJpaDao;
import com.web.SearchWeb.folder.domain.FolderType;
import com.web.SearchWeb.folder.domain.MemberFolder;
import com.web.SearchWeb.folder.error.FolderException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MemberFolderServiceImplPinnedTest {
    @Mock MemberFolderJpaDao folders;
    @Mock BookmarkDao bookmarks;
    MemberFolderServiceImpl service;

    @BeforeEach void setup() { service = new MemberFolderServiceImpl(folders, bookmarks); }

    private MemberFolder folder(long id, long owner, FolderType type, Long parent, boolean pinned) {
        return MemberFolder.builder().memberFolderId(id).ownerMemberId(owner).folderName("Folder")
            .folderType(type).parentFolderId(parent).pinned(pinned).build();
    }

    @Test void createsPinnedRootAtomicallyWithFolderAndDefaultsOldCallOff() {
        when(folders.findFirstByOwnerMemberIdAndParentFolderIdIsNullAndFolderNameIgnoreCaseAndDeletedAtIsNull(anyLong(), anyString()))
            .thenReturn(Optional.empty());
        when(folders.save(any(MemberFolder.class))).thenAnswer(inv -> {
            MemberFolder f = inv.getArgument(0);
            return MemberFolder.builder().memberFolderId(8L).ownerMemberId(f.getOwnerMemberId())
                .folderName(f.getFolderName()).folderType(f.getFolderType())
                .parentFolderId(f.getParentFolderId()).pinned(f.isPinned()).build();
        });
        assertThat(service.create(1L, null, "A", null, true)).isEqualTo(8L);
        verify(folders).save(argThat(f -> f.isPinned() && f.getOwnerMemberId().equals(1L)));
        assertThat(service.create(1L, null, "B", null)).isEqualTo(8L);
        verify(folders).save(argThat(f -> !f.isPinned() && f.getOwnerMemberId().equals(1L)));
    }

    @Test void rejectsPinnedChildBeforeSave() {
        assertThatThrownBy(() -> service.create(1L, 2L, "child", null, true)).isInstanceOf(FolderException.class);
        verify(folders, never()).save(any());
    }

    @Test void targetValueIsIdempotentForCustomAndUnorganized() {
        for (FolderType type : List.of(FolderType.CUSTOM, FolderType.UNORGANIZED)) {
            MemberFolder f = folder(3, 1, type, null, false);
            when(folders.findByIdForUpdate(3L)).thenReturn(Optional.of(f));
            service.setPinned(1L, 3L, true);
            service.setPinned(1L, 3L, true);
            assertThat(f.isPinned()).isTrue();
            service.setPinned(1L, 3L, false);
            assertThat(f.isPinned()).isFalse();
        }
    }

    @Test void rejectsForeignDeletedAndChildWithoutMutation() {
        MemberFolder foreign = folder(3, 2, FolderType.CUSTOM, null, false);
        MemberFolder child = folder(4, 1, FolderType.CUSTOM, 3L, false);
        MemberFolder deleted = folder(5, 1, FolderType.CUSTOM, null, false);
        deleted.softDelete(1L);
        when(folders.findByIdForUpdate(3L)).thenReturn(Optional.of(foreign));
        when(folders.findByIdForUpdate(4L)).thenReturn(Optional.of(child));
        when(folders.findByIdForUpdate(5L)).thenReturn(Optional.of(deleted));
        assertThatThrownBy(() -> service.setPinned(1L, 3L, true)).isInstanceOf(FolderException.class);
        assertThatThrownBy(() -> service.setPinned(1L, 4L, true)).isInstanceOf(FolderException.class);
        assertThatThrownBy(() -> service.setPinned(1L, 5L, true)).isInstanceOf(FolderException.class);
        assertThat(foreign.isPinned() || child.isPinned() || deleted.isPinned()).isFalse();
    }

    @Test void pinnedListIsOwnedRootActiveOnly() {
        MemberFolder yes = folder(1, 1, FolderType.CUSTOM, null, true);
        MemberFolder unorganized = folder(2, 1, FolderType.UNORGANIZED, null, true);
        MemberFolder off = folder(3, 1, FolderType.CUSTOM, null, false);
        MemberFolder child = folder(4, 1, FolderType.CUSTOM, 1L, true);
        MemberFolder deleted = folder(5, 1, FolderType.CUSTOM, null, true);
        deleted.softDelete(1L);
        when(folders.existsByOwnerMemberIdAndFolderType(1L, FolderType.UNORGANIZED)).thenReturn(true);
        when(folders.findAllByOwnerMemberIdAndParentFolderIdIsNull(1L)).thenReturn(List.of(yes, unorganized, off, deleted));
        assertThat(service.listPinned(1L)).containsExactly(yes, unorganized).doesNotContain(off, child, deleted);
        verify(folders).findAllByOwnerMemberIdAndParentFolderIdIsNull(1L);
    }
}
