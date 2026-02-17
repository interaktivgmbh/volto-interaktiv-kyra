import React, { useEffect, useRef, useState } from 'react';

import Composer from './Composer';
import HistoryDrawer from './HistoryDrawer';
import MessageList from './MessageList';
import SettingsDrawer from './SettingsDrawer';
import type {
  ChatCapabilities,
  ChatConversation,
} from './types';
import { Icon } from '@plone/volto/components';
import { historySVG, newchatSVG, settingsSVG } from '../../helpers/icons';

const getChatLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Volto AI Assistant',
      editorSubtitle: 'Editor-Modus',
      visitorSubtitle: 'Visitor-Modus',
      newChat: 'Neuer Chat',
      history: 'Historie',
      settings: 'Einstellungen',
      menu: 'Men\u00fc',
      close: 'Schlie\u00dfen',
    };
  }
  return {
    title: 'Volto AI Assistant',
    editorSubtitle: 'Editor mode',
    visitorSubtitle: 'Visitor mode',
    newChat: 'Start new chat',
    history: 'History',
    settings: 'Settings',
    menu: 'Menu',
    close: 'Close',
  };
};

type Props = {
  isOpen: boolean;
  isDocked: boolean;
  isSending: boolean;
  error?: string | null;
  conversation?: ChatConversation | null;
  capabilities: ChatCapabilities;
  showHistory: boolean;
  history: ChatConversation[];
  showSettings: boolean;
  onToggleSettings: () => void;
  customIcon: string | null;
  customIconColor: string;
  accentColor: string | null;
  chatName: string | null;
  onSaveSettings: (draft: import('./SettingsDrawer').SettingsDraft) => void;
  onClearHistory: () => void;
  onClose: () => void;
  onToggleHistory: () => void;
  onStartTranslation: () => void;
  onStartSync: () => void;
  onWizardAction: (messageId: string, value: string) => void;
  outdatedCount: number;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string) => void;
  onArchiveConversation: (conversationId: string) => void;
  uiLanguage?: string;
};

const ChatPanel: React.FC<Props> = ({
  isOpen,
  isDocked,
  isSending,
  error,
  conversation,
  capabilities,
  showHistory,
  history,
  showSettings,
  onToggleSettings,
  customIcon,
  customIconColor,
  accentColor,
  chatName,
  onSaveSettings,
  onClearHistory,
  onClose,
  onToggleHistory,
  onStartTranslation,
  onStartSync,
  onWizardAction,
  outdatedCount,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  uiLanguage,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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
          <div>{chatName || t.title}</div>
          <div className="kyra-ai-chat__subtitle">
            {capabilities.can_edit ? t.editorSubtitle : t.visitorSubtitle}
          </div>
        </div>
        <div className="kyra-ai-chat__header-actions">
          <div className="kyra-ai-chat__header-menu" ref={menuRef}>
            <button
              type="button"
              className="kyra-ai-chat__header-icon-button"
              onClick={() => setShowMenu((v) => !v)}
              aria-label={t.menu}
              title={t.menu}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <div className="kyra-ai-chat__header-menu-panel">
                <button
                  type="button"
                  onClick={() => {
                    onToggleSettings();
                    setShowMenu(false);
                  }}
                >
                  <Icon name={settingsSVG} size="14px" />
                  <span>{t.settings}</span>
                </button>
              </div>
            )}
          </div>
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
            className="kyra-ai-chat__header-icon-button"
            onClick={onNewConversation}
            aria-label={t.newChat}
            title={t.newChat}
          >
            <Icon name={newchatSVG} size="18px" />
          </button>
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
      <div className="kyra-ai-chat__body">
        {error && <div className="kyra-ai-chat__error">{error}</div>}
        <MessageList
          messages={conversation?.messages || []}
          uiLanguage={uiLanguage}
          onAction={onWizardAction}
        />
      </div>
      <Composer
        onTranslateClick={onStartTranslation}
        onSyncClick={onStartSync}
        outdatedCount={outdatedCount}
        disabled={isSending}
        uiLanguage={uiLanguage}
      />
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
        onSave={onSaveSettings}
        onClearHistory={onClearHistory}
        currentCustomIcon={customIcon}
        currentIconColor={customIconColor}
        currentAccentColor={accentColor}
        currentChatName={chatName}
        historyCount={history.length}
        uiLanguage={uiLanguage}
      />
    </div>
  );
};

export default ChatPanel;
