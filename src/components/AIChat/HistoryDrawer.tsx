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
      toggleArchived: 'Archiv',
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
    };
  }
  return {
    recent: 'Recent chats',
    archived: 'Archived chats',
    newChat: 'New',
    toggleArchived: 'Archived',
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

  return (
    <div
      className={`kyra-ai-chat__history${
        open ? ' kyra-ai-chat__history--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__history-header">
        <div>{showArchived ? t.archived : t.recent}</div>
        <div className="kyra-ai-chat__history-controls">
          <button type="button" onClick={onNew}>
            {t.newChat}
          </button>
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className={`kyra-ai-chat__history-archived-toggle${
              showArchived ? ' is-active' : ''
            }`}
          >
            {t.toggleArchived}
          </button>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
      <div className="kyra-ai-chat__history-list">
        {filteredConversations.length === 0 && (
          <div className="kyra-ai-chat__history-empty">
            {showArchived ? t.emptyArchived : t.empty}
          </div>
        )}
        {filteredConversations.map((conversation) => {
            const isPinned = Boolean(conversation.pinned);
            const isArchived = Boolean(conversation.archived);
          return (
            <div
              key={conversation.id}
              role="button"
              tabIndex={0}
              className={`kyra-ai-chat__history-item${
                conversation.id === activeId
                  ? ' kyra-ai-chat__history-item--active'
                  : ''
              }${isArchived ? ' kyra-ai-chat__history-item--archived' : ''}`}
              onClick={() => {
                onSelect(conversation.id);
                setMenuOpen(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(conversation.id);
                }
              }}
            >
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryDrawer;
