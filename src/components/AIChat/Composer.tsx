import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Icon } from '@plone/volto/components';
import { translateSVG } from '../../helpers/icons';
import type { ChatCapabilities } from './types';
import { hasPermission } from './types';

type Props = {
  onSend?: (text: string) => void;
  onTranslateClick?: () => void;
  onSyncClick?: () => void;
  onPromptsClick?: () => void;
  onFilesSelected?: (files: File[]) => void;
  attachments?: { name: string; id: string }[];
  onRemoveAttachment?: (id: string) => void;
  outdatedCount?: number;
  disabled?: boolean;
  uiLanguage?: string;
  contextMode?: 'page' | 'site' | 'selection';
  contextLabel?: string | null;
  onDismissContext?: () => void;
  capabilities?: ChatCapabilities;
  editModeActive?: boolean;
  editBackendUrl?: string;
  onEditModeToggle?: () => void;
};

const getComposerLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      translate: '\u00dcbersetzen',
      sync: 'Synchronisieren',
      prompts: 'Gespeicherte Prompts',
      placeholder: 'Nachricht eingeben\u2026',
      send: 'Senden',
      edit: 'Bearbeiten',
      editActive: 'Bearbeiten (aktiv)',
      editModeTag: 'Bearbeiten-Modus',
      attachFiles: 'Fotos und Dateien hinzuf\u00fcgen',
      micStart: 'Spracheingabe starten',
      micStop: 'Spracheingabe stoppen',
    };
  }
  return {
    translate: 'Translate',
    sync: 'Sync translations',
    prompts: 'Saved Prompts',
    placeholder: 'Type a message\u2026',
    send: 'Send',
    edit: 'Edit',
    editActive: 'Edit (active)',
    editModeTag: 'Edit mode',
    attachFiles: 'Add photos and files',
    micStart: 'Start voice input',
    micStop: 'Stop voice input',
  };
};

const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

const DEFAULT_CAPS: ChatCapabilities = { is_anonymous: true, can_edit: false, features: [] };

const Composer: React.FC<Props> = ({
  onSend,
  onTranslateClick,
  onSyncClick,
  onPromptsClick,
  onFilesSelected,
  attachments = [],
  onRemoveAttachment,
  outdatedCount = 0,
  disabled,
  uiLanguage,
  contextMode,
  contextLabel,
  onDismissContext,
  capabilities = DEFAULT_CAPS,
  editModeActive,
  editBackendUrl,
  onEditModeToggle,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textBeforeSpeechRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getComposerLabels(uiLanguage);

  const speechAvailable = !!getSpeechRecognition();

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setText('');
  };

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    stopListening();

    textBeforeSpeechRef.current = text;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = (uiLanguage || 'de').startsWith('de') ? 'de-DE' : 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const prefix = textBeforeSpeechRef.current
        ? textBeforeSpeechRef.current.trimEnd() + ' '
        : '';
      setText(prefix + transcript);
    };

    recognition.onerror = () => {
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [uiLanguage, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  return (
    <div className="kyra-ai-chat__composer">
      {attachments.length > 0 && (
        <div className="kyra-ai-chat__composer-attachments">
          {attachments.map((att) => (
            <span key={att.id} className="kyra-ai-chat__composer-chip">
              <span>{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment?.(att.id)}
                aria-label="Remove"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      {(contextLabel || editModeActive) && (
        <div className="kyra-ai-chat__composer-context">
          {editModeActive && (
            <span className="kyra-ai-chat__context-tag kyra-ai-chat__context-tag--edit">
              <button
                type="button"
                onClick={onEditModeToggle}
                aria-label="Disable edit mode"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span>{t.editModeTag}</span>
            </span>
          )}
          {contextLabel && (
            <span
              className={`kyra-ai-chat__context-tag${
                contextMode === 'selection'
                  ? ' kyra-ai-chat__context-tag--selection'
                  : ''
              }`}
            >
              <button
                type="button"
                onClick={onDismissContext}
                aria-label="Remove context"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span>{contextLabel}</span>
            </span>
          )}
        </div>
      )}
      <div className="kyra-ai-chat__composer-row">
        <div className="kyra-ai-chat__composer-plus-menu" ref={plusMenuRef}>
          <button
            type="button"
            className="kyra-ai-chat__composer-icon-button"
            onClick={() => setShowPlusMenu((v) => !v)}
            disabled={disabled}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showPlusMenu && (
            <div className="kyra-ai-chat__composer-plus-panel">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowPlusMenu(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span>{t.attachFiles}</span>
              </button>
              {hasPermission(capabilities, 'translate') && (
                <button
                  type="button"
                  onClick={() => {
                    onTranslateClick?.();
                    setShowPlusMenu(false);
                  }}
                >
                  <Icon name={translateSVG} size="20px" />
                  <span>{t.translate}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onPromptsClick?.();
                  setShowPlusMenu(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{t.prompts}</span>
              </button>
              {editBackendUrl && (
                <button
                  type="button"
                  className={`kyra-ai-chat__composer-plus-item${editModeActive ? ' kyra-ai-chat__composer-plus-item--active' : ''}`}
                  onClick={() => {
                    onEditModeToggle?.();
                    setShowPlusMenu(false);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>{editModeActive ? t.editActive : t.edit}</span>
                </button>
              )}
              {hasPermission(capabilities, 'translate') && outdatedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncClick?.();
                    setShowPlusMenu(false);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6" />
                    <path d="M2.5 22v-6h6" />
                    <path d="M2.5 11.5a10 10 0 0 1 16.5-5.3L21.5 8" />
                    <path d="M21.5 12.5a10 10 0 0 1-16.5 5.3L2.5 16" />
                  </svg>
                  <span>{t.sync}</span>
                  <span className="kyra-ai-chat__composer-badge">{outdatedCount}</span>
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.md,.odt,.csv,.xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                onFilesSelected?.(Array.from(files));
              }
              e.target.value = '';
            }}
          />
        </div>
        <textarea
          ref={inputRef}
          className="kyra-ai-chat__composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={t.placeholder}
          disabled={disabled}
          rows={1}
        />
        {speechAvailable && (
          <button
            type="button"
            className={`kyra-ai-chat__composer-mic-button${isListening ? ' kyra-ai-chat__composer-mic-button--active' : ''}`}
            onClick={toggleListening}
            disabled={disabled}
            aria-label={isListening ? t.micStop : t.micStart}
            title={isListening ? t.micStop : t.micStart}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="1" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="8" y1="21" x2="16" y2="21" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="kyra-ai-chat__composer-send-button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          aria-label={t.send}
          title={t.send}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="4" />
            <polyline points="5 11 12 4 19 11" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Composer;
