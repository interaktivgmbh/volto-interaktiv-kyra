import React from 'react';

import ActionsTab from './ActionsTab';
import Composer from './Composer';
import HistoryDrawer from './HistoryDrawer';
import MessageList from './MessageList';
import SettingsDrawer from './SettingsDrawer';
import type {
  ChatCapabilities,
  ChatContextPayload,
  ChatConversation,
  ChatMessage,
  ChatQuickAction,
} from './types';
import { Icon } from '@plone/volto/components';
import { historySVG, newchatSVG, settingsSVG } from '../../helpers/icons';

const getChatLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Kyra AI',
      editorSubtitle: 'Editor-Modus',
      visitorSubtitle: 'Visitor-Modus',
      chatTab: 'Chat',
      actionsTab: 'Actions',
      newChat: 'Neuer Chat',
      history: 'Historie',
      settings: 'Einstellungen',
      float: 'Float',
      dock: 'Dock',
      close: 'Schließen',
    };
  }
  return {
    title: 'Kyra AI',
    editorSubtitle: 'Editor mode',
    visitorSubtitle: 'Visitor mode',
    chatTab: 'Chat',
    actionsTab: 'Actions',
    newChat: 'Start new chat',
    history: 'History',
    settings: 'Settings',
    float: 'Float',
    dock: 'Dock',
    close: 'Close',
  };
};

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
  showSettings: boolean;
  onToggleSettings: () => void;
  customIcon: string | null;
  customIconColor: string;
  onIconChange: (dataUrl: string | null) => void;
  onIconColorChange: (color: string) => void;
  onClose: () => void;
  onToggleDock: () => void;
  onToggleHistory: () => void;
  onTabChange: (tab: 'chat' | 'actions') => void;
  onSend: (content: string, contextOverrides?: Partial<ChatContextPayload>) => void;
  quickActions?: ChatQuickAction[];
  onQuickAction?: (action: ChatQuickAction) => void;
  onRegenerate?: (message: ChatMessage) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string) => void;
  onArchiveConversation: (conversationId: string) => void;
  uiLanguage?: string;
  languageNotice?: string;
  attachments?: Array<{ file_id: string; name?: string }>;
  onUploadFile?: (file: File) => void;
  onRemoveAttachment?: (file_id: string) => void;
};

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
  showSettings,
  onToggleSettings,
  customIcon,
  customIconColor,
  onIconChange,
  onIconColorChange,
  onActionsApplied,
  onClose,
  onToggleDock,
  onToggleHistory,
  onTabChange,
  onSend,
    onRegenerate,
    onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  uiLanguage,
  quickActions = [],
  onQuickAction,
  languageNotice,
  attachments = [],
  onUploadFile,
  onRemoveAttachment,
}) => {
  if (!isOpen) return null;
  const t = getChatLabels(uiLanguage);

  return (
    <div
      className={`kyra-ai-chat__panel${
        isDocked ? ' kyra-ai-chat__panel--docked' : ''
      }`}
    >
      <div className="kyra-ai-chat__header">
        <div className="kyra-ai-chat__title">
          <div>{t.title}</div>
          <div className="kyra-ai-chat__subtitle">
            {capabilities.can_edit ? t.editorSubtitle : t.visitorSubtitle}
          </div>
        </div>
        <div className="kyra-ai-chat__header-actions">
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button"
            onClick={onNewConversation}
            aria-label={t.newChat}
            title={t.newChat}
          >
            <Icon name={newchatSVG} size="18px" />
          </button>
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button kyra-ai-chat__header-icon-button--history"
            onClick={onToggleHistory}
            aria-label={t.history}
            title={t.history}
          >
            <Icon name={historySVG} size="18px" />
          </button>
          <button
            type="button"
            className="kyra-ai-chat__header-icon-button kyra-ai-chat__header-icon-button--settings"
            onClick={onToggleSettings}
            aria-label={t.settings}
            title={t.settings}
          >
            <Icon name={settingsSVG} size="18px" />
          </button>
          <button type="button" onClick={onToggleDock}>
            {isDocked ? t.float : t.dock}
          </button>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
      {/* Language notice logic kept in backend but not shown in UI */}
      {capabilities.can_edit && (
        <div className="kyra-ai-chat__tabs">
          <button
            type="button"
            className={activeTab === 'chat' ? 'is-active' : ''}
            onClick={() => onTabChange('chat')}
          >
            {t.chatTab}
          </button>
          <button
            type="button"
            className={activeTab === 'actions' ? 'is-active' : ''}
            onClick={() => onTabChange('actions')}
          >
            {t.actionsTab}
          </button>
        </div>
      )}
      <div className="kyra-ai-chat__body">
        {activeTab === 'chat' ? (
          <>
            {error && <div className="kyra-ai-chat__error">{error}</div>}
            {quickActions?.length ? (
              <div className="kyra-ai-chat__quick-actions">
                {quickActions.map((action) => (
                  <button
                    type="button"
                    key={`${action.mode}-${action.label}`}
                    onClick={() => onQuickAction?.(action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            <MessageList
              messages={conversation?.messages || []}
              uiLanguage={uiLanguage}
              onRegenerate={onRegenerate}
            />
          </>
        ) : (
          <ActionsTab
            canEdit={capabilities.can_edit}
            pageContext={pageContext}
            uiLanguage={uiLanguage}
            onApplied={onActionsApplied}
          />
        )}
      </div>
      {activeTab === 'chat' && (
        <Composer
          onSend={onSend}
          onUpload={onUploadFile}
          onRemoveAttachment={onRemoveAttachment}
          attachments={attachments}
          disabled={isSending}
          rows={isDocked ? 5 : 2}
          uiLanguage={uiLanguage}
        />
      )}
      <HistoryDrawer
        open={showHistory}
        conversations={history}
        activeId={conversation?.id}
        onSelect={onSelectConversation}
        onClose={onToggleHistory}
        onNew={onNewConversation}
        onDelete={onDeleteConversation}
        onRename={onRenameConversation}
        onPinToggle={onPinConversation}
        onArchiveToggle={onArchiveConversation}
        uiLanguage={uiLanguage}
      />
      <SettingsDrawer
        open={showSettings}
        onClose={onToggleSettings}
        onIconChange={onIconChange}
        onIconColorChange={onIconColorChange}
        currentCustomIcon={customIcon}
        currentIconColor={customIconColor}
        uiLanguage={uiLanguage}
      />
    </div>
  );
};

export default ChatPanel;
