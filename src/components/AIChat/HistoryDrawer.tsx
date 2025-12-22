import React from 'react';

import type { ChatConversation } from './types';

type Props = {
  open: boolean;
  conversations: ChatConversation[];
  activeId?: string;
  onSelect: (conversationId: string) => void;
  onClose: () => void;
  onNew: () => void;
};

const HistoryDrawer: React.FC<Props> = ({
  open,
  conversations,
  activeId,
  onSelect,
  onClose,
  onNew,
}) => {
  return (
    <div
      className={`kyra-ai-chat__history${
        open ? ' kyra-ai-chat__history--open' : ''
      }`}
    >
      <div className="kyra-ai-chat__history-header">
        <div>Recent chats</div>
        <div className="kyra-ai-chat__history-controls">
          <button type="button" onClick={onNew}>
            New
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="kyra-ai-chat__history-list">
        {conversations.length === 0 && (
          <div className="kyra-ai-chat__history-empty">
            No conversations yet.
          </div>
        )}
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className={`kyra-ai-chat__history-item${
              conversation.id === activeId
                ? ' kyra-ai-chat__history-item--active'
                : ''
            }`}
            onClick={() => onSelect(conversation.id)}
          >
            <div className="kyra-ai-chat__history-title">
              {conversation.title || 'Untitled'}
            </div>
            <div className="kyra-ai-chat__history-meta">
              {new Date(conversation.updatedAt).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HistoryDrawer;
