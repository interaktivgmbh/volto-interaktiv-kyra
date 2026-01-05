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
        <div>{showArchived ? 'Archived chats' : 'Recent chats'}</div>
        <div className="kyra-ai-chat__history-controls">
          <button type="button" onClick={onNew}>
            New
          </button>
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className={`kyra-ai-chat__history-archived-toggle${
              showArchived ? ' is-active' : ''
            }`}
          >
            Archived
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="kyra-ai-chat__history-list">
        {filteredConversations.length === 0 && (
          <div className="kyra-ai-chat__history-empty">
            {showArchived
              ? 'No archived conversations yet.'
              : 'No conversations yet.'}
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
                {conversation.title || 'Untitled'}
                {isPinned && <span className="kyra-ai-chat__history-pin">★</span>}
                {isArchived && (
                  <span className="kyra-ai-chat__history-archived">archived</span>
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
                  aria-label="Conversation actions"
                >
                  ⋮
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
                      Rename chat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onPinToggle(conversation.id);
                        setMenuOpen(null);
                      }}
                    >
                      {isPinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onArchiveToggle(conversation.id);
                        setMenuOpen(null);
                      }}
                    >
                      {isArchived ? 'Unarchive chat' : 'Archive chat'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(conversation.id);
                        setMenuOpen(null);
                      }}
                    >
                      Delete chat
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
