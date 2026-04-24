import React, { useEffect, useRef, useState } from 'react';

import Composer from './Composer';
import HistoryDrawer from './HistoryDrawer';
import MessageList from './MessageList';
import SettingsDrawer from './SettingsDrawer';
import TagMappingsPanel from './TagMappingsPanel';
import GlossaryPanel from './GlossaryPanel';
import PromptsPanel from './PromptsPanel';
import PromptPicker from './PromptPicker';
import PermissionMatrixPanel from './PermissionMatrixPanel';
import type {
  ChatCapabilities,
  ChatConversation,
} from './types';
import { hasPermission } from './types';
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
      prompts: 'Promptmanager',
      permissions: 'Berechtigungen',
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
    prompts: 'Prompt Manager',
    permissions: 'Permissions',
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
  onSend: (text: string) => void;
  onStartTranslation: () => void;
  onStartSync: () => void;
  onPromptsClick: () => void;
  onApplyPrompt: (text: string) => void;
  onWizardAction: (messageId: string, value: string) => void;
  outdatedCount: number;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string) => void;
  onArchiveConversation: (conversationId: string) => void;
  uiLanguage?: string;
  contextMode: 'page' | 'site' | 'selection';
  contextLabel: string | null;
  onDismissContext: () => void;
  editingMessageId: string | null;
  onEditAndResend: (messageId: string, newText: string) => void;
  onCancelEdit: () => void;
  editModeActive?: boolean;
  editBackendUrl?: string;
  onEditModeToggle?: () => void;
  onFilesSelected?: (files: File[]) => void;
  attachments?: { name: string; id: string }[];
  onRemoveAttachment?: (id: string) => void;
  skills?: { name: string; description: string }[];
  onRestoreState?: (messageUid: string) => void;
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
  onSend,
  onStartTranslation,
  onStartSync,
  onPromptsClick,
  onApplyPrompt,
  onWizardAction,
  outdatedCount,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  uiLanguage,
  contextMode,
  contextLabel,
  onDismissContext,
  editingMessageId,
  onEditAndResend,
  onCancelEdit,
  editModeActive,
  editBackendUrl,
  onEditModeToggle,
  onFilesSelected,
  attachments,
  onRemoveAttachment,
  skills = [],
  onRestoreState,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showTagMappings, setShowTagMappings] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const DOCK_WIDTH_STORAGE_KEY = 'kyra.chatDockedWidth';
  const DOCK_WIDTH_DEFAULT = 520;
  const DOCK_WIDTH_MIN = 360;
  const DOCK_WIDTH_MAX_FRAC = 0.8;

  const [dockedWidth, setDockedWidth] = useState<number>(DOCK_WIDTH_DEFAULT);
  const dockedWidthRef = useRef<number>(DOCK_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DOCK_WIDTH_STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= DOCK_WIDTH_MIN) {
          setDockedWidth(parsed);
          dockedWidthRef.current = parsed;
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    dockedWidthRef.current = dockedWidth;
  }, [dockedWidth]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDocked && isOpen) {
      root.style.setProperty('--kyra-ai-chat-docked-width', `${dockedWidth}px`);
    } else {
      root.style.removeProperty('--kyra-ai-chat-docked-width');
    }
    return () => {
      root.style.removeProperty('--kyra-ai-chat-docked-width');
    };
  }, [isDocked, isOpen, dockedWidth]);

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDocked) return;
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = dockedWidthRef.current;
    const maxWidth = Math.floor(window.innerWidth * DOCK_WIDTH_MAX_FRAC);
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const next = Math.max(DOCK_WIDTH_MIN, Math.min(maxWidth, startWidth + delta));
      dockedWidthRef.current = next;
      setDockedWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try {
        window.localStorage.setItem(
          DOCK_WIDTH_STORAGE_KEY,
          String(dockedWidthRef.current),
        );
      } catch (_) {}
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

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
      }${isResizing ? ' is-resizing' : ''}`}
    >
      {isDocked && (
        <div
          className="kyra-ai-chat__resize-handle"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat panel"
          title="Drag to resize"
        />
      )}
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
                  disabled={!hasPermission(capabilities, 'manage_settings')}
                  className={!hasPermission(capabilities, 'manage_settings') ? 'kyra-ai-chat__menu-item--disabled' : undefined}
                  onClick={() => {
                    onToggleSettings();
                    setShowMenu(false);
                  }}
                >
                  <Icon name={settingsSVG} size="14px" />
                  <span>{t.settings}</span>
                </button>
                {capabilities.is_admin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermissionMatrix(true);
                      setShowMenu(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>{t.permissions}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!hasPermission(capabilities, 'manage_tag_mappings')}
                  className={!hasPermission(capabilities, 'manage_tag_mappings') ? 'kyra-ai-chat__menu-item--disabled' : undefined}
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
                <button
                  type="button"
                  disabled={!hasPermission(capabilities, 'manage_glossary')}
                  className={!hasPermission(capabilities, 'manage_glossary') ? 'kyra-ai-chat__menu-item--disabled' : undefined}
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
                <button
                  type="button"
                  disabled={!hasPermission(capabilities, 'manage_prompts')}
                  className={!hasPermission(capabilities, 'manage_prompts') ? 'kyra-ai-chat__menu-item--disabled' : undefined}
                  onClick={() => {
                    setShowPrompts(true);
                    setShowMenu(false);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>{t.prompts}</span>
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
        {showPromptPicker ? (
          <PromptPicker
            open={showPromptPicker}
            onClose={() => setShowPromptPicker(false)}
            onApplyPrompt={onApplyPrompt}
            uiLanguage={uiLanguage}
          />
        ) : (
          <MessageList
            messages={conversation?.messages || []}
            uiLanguage={uiLanguage}
            onAction={onWizardAction}
            editingMessageId={editingMessageId}
            onEditAndResend={onEditAndResend}
            onCancelEdit={onCancelEdit}
            onRestoreState={onRestoreState}
          />
        )}
      </div>
      <Composer
        onSend={onSend}
        onTranslateClick={onStartTranslation}
        onSyncClick={onStartSync}
        onPromptsClick={() => setShowPromptPicker(true)}
        outdatedCount={outdatedCount}
        disabled={isSending}
        uiLanguage={uiLanguage}
        contextMode={contextMode}
        contextLabel={contextLabel}
        onDismissContext={onDismissContext}
        capabilities={capabilities}
        editModeActive={editModeActive}
        editBackendUrl={editBackendUrl}
        onEditModeToggle={onEditModeToggle}
        onFilesSelected={onFilesSelected}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        skills={skills}
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
        currentLanguage={uiLanguage}
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
      <PromptsPanel
        open={showPrompts}
        onClose={() => setShowPrompts(false)}
        onApplyPrompt={onApplyPrompt}
        uiLanguage={uiLanguage}
      />
      <PermissionMatrixPanel
        open={showPermissionMatrix}
        onClose={() => setShowPermissionMatrix(false)}
        uiLanguage={uiLanguage}
      />
    </div>
  );
};

export default ChatPanel;
