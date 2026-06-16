// Ported concept from openchamber/openchamber (MIT): packages/ui/src/components/session/SessionFolderItem.tsx
// Adapted for Paseo's React Native sidebar: renders workspace folders (collapsible) with their
// member workspace rows, plus rename/delete affordances. Folder membership and collapse state live
// in workspace-folders-store (client-only, AsyncStorage-persisted). Folder creation and
// move-into-folder happen from the workspace kebab menu (see sidebar-workspace-list.tsx).
import { memo, useCallback, useMemo, useState, type ReactElement } from "react";
import { View, Text, Pressable, type PressableStateCallbackType } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react-native";
import type { Theme } from "@/styles/theme";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { confirmDialog } from "@/utils/confirm-dialog";
import { useWorkspaceFoldersStore, type WorkspaceFolder } from "@/stores/workspace-folders-store";
import type { SidebarWorkspaceEntry } from "@/hooks/use-sidebar-workspaces-list";

const ThemedChevronDown = withUnistyles(ChevronDown);
const ThemedChevronRight = withUnistyles(ChevronRight);
const ThemedFolder = withUnistyles(Folder);
const ThemedFolderOpen = withUnistyles(FolderOpen);
const ThemedMoreVertical = withUnistyles(MoreVertical);
const ThemedPencil = withUnistyles(Pencil);
const ThemedTrash2 = withUnistyles(Trash2);

const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });

const renameLeadingIcon = <ThemedPencil size={14} uniProps={mutedColorMapping} />;
const deleteLeadingIcon = <ThemedTrash2 size={14} uniProps={mutedColorMapping} />;

const EMPTY_FOLDERS: WorkspaceFolder[] = [];

interface WorkspaceFolderSectionProps {
  scopeKey: string;
  /** Resolves a folder's stored workspaceKeys back to live sidebar entries. */
  workspaceByKey: Map<string, SidebarWorkspaceEntry>;
  renderWorkspaceRow: (workspace: SidebarWorkspaceEntry) => ReactElement;
}

interface FolderItemProps {
  scopeKey: string;
  folder: WorkspaceFolder;
  workspaceByKey: Map<string, SidebarWorkspaceEntry>;
  collapsed: boolean;
  renderWorkspaceRow: (workspace: SidebarWorkspaceEntry) => ReactElement;
}

function folderKebabStyle({ hovered = false }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.folderKebabButton, hovered && styles.folderKebabButtonHovered];
}

function FolderItem({
  scopeKey,
  folder,
  workspaceByKey,
  collapsed,
  renderWorkspaceRow,
}: FolderItemProps) {
  const members = useMemo(() => {
    const resolved: SidebarWorkspaceEntry[] = [];
    for (const workspaceKey of folder.workspaceKeys) {
      const entry = workspaceByKey.get(workspaceKey);
      if (entry) {
        resolved.push(entry);
      }
    }
    return resolved;
  }, [folder.workspaceKeys, workspaceByKey]);
  const toggleFolderCollapse = useWorkspaceFoldersStore((state) => state.toggleFolderCollapse);
  const renameFolder = useWorkspaceFoldersStore((state) => state.renameFolder);
  const deleteFolder = useWorkspaceFoldersStore((state) => state.deleteFolder);
  const [renameVisible, setRenameVisible] = useState(false);

  const handleToggle = useCallback(() => {
    toggleFolderCollapse(folder.id);
  }, [toggleFolderCollapse, folder.id]);

  const handleRenameSubmit = useCallback(
    (value: string) => {
      renameFolder(scopeKey, folder.id, value);
      setRenameVisible(false);
    },
    [renameFolder, scopeKey, folder.id],
  );

  const handleDelete = useCallback(() => {
    void (async () => {
      const confirmed = await confirmDialog({
        title: "Delete folder?",
        message: `Delete "${folder.name}"?\n\nWorkspaces inside it stay; only the folder grouping is removed.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
      });
      if (confirmed) {
        deleteFolder(scopeKey, folder.id);
      }
    })();
  }, [deleteFolder, scopeKey, folder.id, folder.name]);

  const handleStartRename = useCallback(() => setRenameVisible(true), []);
  const handleCloseRename = useCallback(() => setRenameVisible(false), []);

  return (
    <View style={styles.folder}>
      <View style={styles.folderHeaderRow}>
        <Pressable
          style={styles.folderHeaderPressable}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
          testID={`workspace-folder-header-${folder.id}`}
        >
          {collapsed ? (
            <ThemedFolder size={14} uniProps={mutedColorMapping} />
          ) : (
            <ThemedFolderOpen size={14} uniProps={mutedColorMapping} />
          )}
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={styles.folderCount}>{members.length}</Text>
          {collapsed ? (
            <ThemedChevronRight size={14} uniProps={mutedColorMapping} />
          ) : (
            <ThemedChevronDown size={14} uniProps={mutedColorMapping} />
          )}
        </Pressable>
        <DropdownMenu>
          <DropdownMenuTrigger
            hitSlop={8}
            style={folderKebabStyle}
            accessibilityLabel="Folder actions"
            testID={`workspace-folder-kebab-${folder.id}`}
          >
            <ThemedMoreVertical size={14} uniProps={mutedColorMapping} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" width={200}>
            <DropdownMenuItem leading={renameLeadingIcon} onSelect={handleStartRename}>
              Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem leading={deleteLeadingIcon} onSelect={handleDelete}>
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
      {!collapsed ? (
        <View style={styles.folderBody}>
          {members.length > 0 ? (
            members.map((workspace) => (
              <View key={workspace.workspaceKey}>{renderWorkspaceRow(workspace)}</View>
            ))
          ) : (
            <Text style={styles.folderEmpty}>Empty folder</Text>
          )}
        </View>
      ) : null}
      <AdaptiveRenameModal
        visible={renameVisible}
        title="Rename folder"
        initialValue={folder.name}
        placeholder="Folder name"
        submitLabel="Rename"
        onClose={handleCloseRename}
        onSubmit={handleRenameSubmit}
      />
    </View>
  );
}

function WorkspaceFolderSectionBase({
  scopeKey,
  workspaceByKey,
  renderWorkspaceRow,
}: WorkspaceFolderSectionProps) {
  const selectScopeFolders = useCallback(
    (state: { foldersMap: Record<string, WorkspaceFolder[]> }) =>
      state.foldersMap[scopeKey] ?? EMPTY_FOLDERS,
    [scopeKey],
  );
  const folders = useWorkspaceFoldersStore(selectScopeFolders);
  const collapsedFolderIds = useWorkspaceFoldersStore((state) => state.collapsedFolderIds);

  const sortedFolders = useMemo(
    () => [...folders].sort((left, right) => left.createdAt - right.createdAt),
    [folders],
  );

  if (sortedFolders.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {sortedFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          scopeKey={scopeKey}
          folder={folder}
          workspaceByKey={workspaceByKey}
          collapsed={collapsedFolderIds.has(folder.id)}
          renderWorkspaceRow={renderWorkspaceRow}
        />
      ))}
    </View>
  );
}

export const WorkspaceFolderSection = memo(WorkspaceFolderSectionBase);

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing[1],
  },
  folder: {
    gap: 2,
  },
  folderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
  },
  folderHeaderPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[1.5],
    borderRadius: theme.borderRadius.base,
    minWidth: 0,
  },
  folderName: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  folderCount: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  folderBody: {
    paddingLeft: theme.spacing[3],
    gap: 2,
  },
  folderEmpty: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[1.5],
  },
  folderKebabButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.base,
  },
  folderKebabButtonHovered: {
    backgroundColor: theme.colors.surface2,
  },
}));
