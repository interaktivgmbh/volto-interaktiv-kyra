import React from 'react';

import type { ChatConversation } from './types';

type Props = {
  open: boolean;
  conversations: ChatConversation[];
  activeId?: string;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  onRename: (conversationId: string) => void;
  onPinToggle: (conversationId: string) => void;
  onArchiveToggle: (conversationId: string) => void;
  onClose: () => void;
  onNew: () => void;
  uiLanguage?: string;
};

const getHistoryLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      recent: 'Letzte Chats',
      archived: 'Archivierte Chats',
      newChat: 'Neuer Chat',
      toggleArchived: 'Archiv anzeigen',
      toggleRecent: 'Aktuelle anzeigen',
      close: 'Schlie\u00dfen',
      empty: 'Keine Unterhaltungen.',
      emptyArchived: 'Keine archivierten Unterhaltungen.',
      untitled: 'Ohne Titel',
      archivedTag: 'archiviert',
      actionsLabel: 'Chat-Aktionen',
      rename: 'Chat umbenennen',
      pin: 'Chat anpinnen',
      unpin: 'Chat l\u00f6sen',
      archive: 'Archivieren',
      unarchive: 'Aus Archiv holen',
      delete: 'L\u00f6schen',
      selectMode: 'Ausw\u00e4hlen',
      cancel: 'Abbrechen',
      selectAll: 'Alle',
      deselectAll: 'Keine',
      deleteSelected: 'L\u00f6schen',
      archiveSelected: 'Archivieren',
      unarchiveSelected: 'Wiederherstellen',
      nSelected: (n: number) => `${n} ausgew\u00e4hlt`,
      menu: 'Men\u00fc',
    };
  }
  return {
    recent: 'Recent chats',
    archived: 'Archived chats',
    newChat: 'New chat',
    toggleArchived: 'Show archived',
    toggleRecent: 'Show recent',
    close: 'Close',
    empty: 'No conversations yet.',
    emptyArchived: 'No archived conversations yet.',
    untitled: 'Untitled',
    archivedTag: 'archived',
    actionsLabel: 'Conversation actions',
    rename: 'Rename chat',
    pin: 'Pin chat',
    unpin: 'Unpin chat',
    archive: 'Archive chat',
    unarchive: 'Unarchive chat',
    delete: 'Delete chat',
    selectMode: 'Select',
    cancel: 'Cancel',
    selectAll: 'All',
    deselectAll: 'None',
    deleteSelected: 'Delete',
    archiveSelected: 'Archive',
    unarchiveSelected: 'Unarchive',
    nSelected: (n: number) => `${n} selected`,
    menu: 'Menu',
  };
};

const HistoryDrawer: React.FC<Props> = ({
  open,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onPinToggle,
  onArchiveToggle,
  onClose,
  onNew,
  uiLanguage,
}) => {
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [headerMenuOpen, setHeaderMenuOpen] = React.useState(false);
  const headerMenuRef = React.useRef<HTMLDivElement>(null);

  const filteredConversations = React.useMemo(
    () =>
      conversations.filter((conversation) =>
        showArchived ? Boolean(conversation.archived) : !conversation.archived,
      ),
    [conversations, showArchived],
  );
  const t = getHistoryLabels(uiLanguage);

  const handleMenu = (conversationId: string) => {
    setMenuOpen((current) => (current === conversationId ? null : conversationId));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filteredConversations.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const handleBulkDelete = () => {
    selected.forEach((id) => onDelete(id));
    exitSelectMode();
  };

  const handleBulkArchive = () => {
    selected.forEach((id) => onArchiveToggle(id));
    exitSelectMode();
  };

  // Close header menu on outside click
  React.useEffect(() => {
    if (!headerMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [headerMenuOpen]);

  // Reset select mode when switching between archived/recent
  React.useEffect(() => {
    exitSelectMode();
  }, [showArchived]);

  // Reset select mode when drawer closes
  React.useEffect(() => {
    if (!open) {
      exitSelectMode();
      setHeaderMenuOpen(false);
    }
  }, [open]);

  const allSelected =
    filteredConversations.length > 0 &&
    filteredConversations.every((c) => selected.has(c.id));

  return (
    <div
      className={`kyra-ai-chat__history${
        open ? ' kyra-ai-chat__history--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__history-header">
        <div>{showArchived ? t.archived : t.recent}</div>
        <div className="kyra-ai-chat__history-controls">
          {selectMode && (
            <button type="button" onClick={exitSelectMode}>
              {t.cancel}
            </button>
          )}
          <div className="kyra-ai-chat__history-header-menu" ref={headerMenuRef}>
            <button
              type="button"
              className="kyra-ai-chat__header-icon-button"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              aria-label={t.menu}
              title={t.menu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {headerMenuOpen && (
              <div className="kyra-ai-chat__header-menu-panel">
                <button
                  type="button"
                  onClick={() => {
                    onNew();
                    setHeaderMenuOpen(false);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{t.newChat}</span>
                </button>
                {filteredConversations.length > 0 && !selectMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectMode(true);
                      setHeaderMenuOpen(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    <span>{t.selectMode}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived((v) => !v);
                    setHeaderMenuOpen(false);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="5" rx="1" />
                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  <span>{showArchived ? t.toggleRecent : t.toggleArchived}</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {selectMode && filteredConversations.length > 0 && (
        <div className="kyra-ai-chat__history-bulk-bar">
          <div className="kyra-ai-chat__history-bulk-info">
            <button
              type="button"
              className="kyra-ai-chat__history-bulk-toggle"
              onClick={allSelected ? deselectAll : selectAll}
            >
              {allSelected ? t.deselectAll : t.selectAll}
            </button>
            <span>{t.nSelected(selected.size)}</span>
          </div>
          <div className="kyra-ai-chat__history-bulk-actions">
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={handleBulkArchive}
            >
              {showArchived ? t.unarchiveSelected : t.archiveSelected}
            </button>
            <button
              type="button"
              className="kyra-ai-chat__history-bulk-delete"
              disabled={selected.size === 0}
              onClick={handleBulkDelete}
            >
              {t.deleteSelected}
            </button>
          </div>
        </div>
      )}

      <div className="kyra-ai-chat__history-list">
        {filteredConversations.length === 0 && (
          <div className="kyra-ai-chat__history-empty">
            {showArchived ? t.emptyArchived : t.empty}
          </div>
        )}
        {filteredConversations.map((conversation) => {
          const isPinned = Boolean(conversation.pinned);
          const isArchived = Boolean(conversation.archived);
          const isSelected = selected.has(conversation.id);
          return (
            <div
              key={conversation.id}
              role="button"
              tabIndex={0}
              className={`kyra-ai-chat__history-item${
                conversation.id === activeId
                  ? ' kyra-ai-chat__history-item--active'
                  : ''
              }${isArchived ? ' kyra-ai-chat__history-item--archived' : ''}${
                isSelected ? ' kyra-ai-chat__history-item--selected' : ''
              }`}
              onClick={() => {
                if (selectMode) {
                  toggleSelected(conversation.id);
                } else {
                  onSelect(conversation.id);
                  setMenuOpen(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (selectMode) {
                    toggleSelected(conversation.id);
                  } else {
                    onSelect(conversation.id);
                  }
                }
              }}
            >
              {selectMode && (
                <div
                  className={`kyra-ai-chat__history-checkbox${
                    isSelected ? ' kyra-ai-chat__history-checkbox--checked' : ''
                  }`}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )}
              <div className="kyra-ai-chat__history-item-content">
                <div className="kyra-ai-chat__history-title">
                  {conversation.title || t.untitled}
                  {isPinned && <span className="kyra-ai-chat__history-pin">{'\u2605'}</span>}
                  {isArchived && (
                    <span className="kyra-ai-chat__history-archived">{t.archivedTag}</span>
                  )}
                </div>
                <div className="kyra-ai-chat__history-meta">
                  {new Date(conversation.updatedAt).toLocaleString()}
                </div>
              </div>
              {!selectMode && (
                <div className="kyra-ai-chat__history-menu">
                  <button
                    type="button"
                    className="kyra-ai-chat__history-menu-trigger"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleMenu(conversation.id);
                    }}
                    aria-label={t.actionsLabel}
                  >
                    {'\u22ee'}
                  </button>
                  {menuOpen === conversation.id && (
                    <div className="kyra-ai-chat__history-menu-panel">
                      <button
                        type="button"
                        onClick={() => {
                          onRename(conversation.id);
                          setMenuOpen(null);
                        }}
                      >
                        {t.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onPinToggle(conversation.id);
                          setMenuOpen(null);
                        }}
                      >
                        {isPinned ? t.unpin : t.pin}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onArchiveToggle(conversation.id);
                          setMenuOpen(null);
                        }}
                      >
                        {isArchived ? t.unarchive : t.archive}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(conversation.id);
                          setMenuOpen(null);
                        }}
                      >
                        {t.delete}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryDrawer;
