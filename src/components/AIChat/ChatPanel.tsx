import React from 'react';

import ActionsTab from './ActionsTab';
import Composer from './Composer';
import HistoryDrawer from './HistoryDrawer';
import MessageList from './MessageList';
import type { ChatCapabilities, ChatContextPayload, ChatConversation, ChatMessage } from './types';
import { Icon } from '@plone/volto/components';
import { historySVG, newchatSVG } from '../../helpers/icons';

type Props = {
  isOpen: boolean;
  isDocked: boolean;
  activeTab: 'chat' | 'actions';
  isSending: boolean;
  error?: string | null;
  conversation?: ChatConversation | null;
  capabilities: ChatCapabilities;
  showHistory: boolean;
  history: ChatConversation[];
  pageContext?: ChatContextPayload;
  onActionsApplied?: (result: { reload?: boolean }) => void;
  onClose: () => void;
  onToggleDock: () => void;
  onToggleHistory: () => void;
  onTabChange: (tab: 'chat' | 'actions') => void;
  onSend: (content: string) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
};

const QUICK_ACTIONS = [
  'Summarize this page',
  'Find related content',
  'Answer questions about this page',
];

const ChatPanel: React.FC<Props> = ({
  isOpen,
  isDocked,
  activeTab,
  isSending,
  error,
  conversation,
  capabilities,
  showHistory,
  history,
  pageContext,
  onActionsApplied,
  onClose,
  onToggleDock,
  onToggleHistory,
  onTabChange,
  onSend,
  onRegenerate,
  onSelectConversation,
  onNewConversation,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`kyra-ai-chat__panel${
        isDocked ? ' kyra-ai-chat__panel--docked' : ''
      }`}
    >
      <div className="kyra-ai-chat__header">
        <div className="kyra-ai-chat__title">
          <div>Kyra AI</div>
          <div className="kyra-ai-chat__subtitle">
            {capabilities.can_edit ? 'Editor mode' : 'Visitor mode'}
          </div>
        </div>
        <div className="kyra-ai-chat__header-actions">
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button"
            onClick={onNewConversation}
            aria-label="Start new chat"
            title="Start new chat"
          >
            <Icon name={newchatSVG} size="18px" />
          </button>
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button kyra-ai-chat__header-icon-button--history"
            onClick={onToggleHistory}
            aria-label="History"
            title="History"
          >
            <Icon name={historySVG} size="18px" />
          </button>
          <button type="button" onClick={onToggleDock}>
            {isDocked ? 'Float' : 'Dock'}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {capabilities.can_edit && (
        <div className="kyra-ai-chat__tabs">
          <button
            type="button"
            className={activeTab === 'chat' ? 'is-active' : ''}
            onClick={() => onTabChange('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={activeTab === 'actions' ? 'is-active' : ''}
            onClick={() => onTabChange('actions')}
          >
            Actions
          </button>
        </div>
      )}
      <div className="kyra-ai-chat__body">
        {activeTab === 'chat' ? (
          <>
            {error && <div className="kyra-ai-chat__error">{error}</div>}
            <div className="kyra-ai-chat__quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button
                  type="button"
                  key={action}
                  onClick={() => onSend(action)}
                >
                  {action}
                </button>
              ))}
            </div>
            <MessageList
              messages={conversation?.messages || []}
              onRegenerate={onRegenerate}
            />
          </>
        ) : (
          <ActionsTab
            canEdit={capabilities.can_edit}
            pageContext={pageContext}
            onApplied={onActionsApplied}
          />
        )}
      </div>
      {activeTab === 'chat' && (
        <Composer onSend={onSend} disabled={isSending} rows={isDocked ? 5 : 2} />
      )}
      <HistoryDrawer
        open={showHistory}
        conversations={history}
        activeId={conversation?.id}
        onSelect={onSelectConversation}
        onClose={onToggleHistory}
        onNew={onNewConversation}
      />
    </div>
  );
};

export default ChatPanel;
