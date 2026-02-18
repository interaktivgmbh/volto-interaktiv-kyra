import React, { useEffect, useRef, useState } from 'react';

import Composer from './Composer';
import HistoryDrawer from './HistoryDrawer';
import MessageList from './MessageList';
import SettingsDrawer from './SettingsDrawer';
import TagMappingsPanel from './TagMappingsPanel';
import GlossaryPanel from './GlossaryPanel';
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
      tagMappings: 'Schlagwort-Mappings',
      glossary: 'DeepL Glossar',
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
    tagMappings: 'Tag Mappings',
    glossary: 'DeepL Glossary',
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
  const [showTagMappings, setShowTagMappings] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
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
                {capabilities.can_edit && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTagMappings(true);
                      setShowMenu(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    <span>{t.tagMappings}</span>
                  </button>
                )}
                {capabilities.can_edit && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowGlossary(true);
                      setShowMenu(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span>{t.glossary}</span>
                  </button>
                )}
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
      <TagMappingsPanel
        open={showTagMappings}
        onClose={() => setShowTagMappings(false)}
        uiLanguage={uiLanguage}
      />
      <GlossaryPanel
        open={showGlossary}
        onClose={() => setShowGlossary(false)}
        uiLanguage={uiLanguage}
      />
    </div>
  );
};

export default ChatPanel;
