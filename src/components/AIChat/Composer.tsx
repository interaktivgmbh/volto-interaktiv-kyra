import React, { useState, useEffect, useRef } from 'react';

import { Icon } from '@plone/volto/components';
import { translateSVG } from '../../helpers/icons';
import type { ChatCapabilities } from './types';
import { hasPermission } from './types';

type Props = {
  onSend?: (text: string) => void;
  onTranslateClick?: () => void;
  onSyncClick?: () => void;
  onPromptsClick?: () => void;
  outdatedCount?: number;
  disabled?: boolean;
  uiLanguage?: string;
  contextMode?: 'page' | 'site' | 'selection';
  contextLabel?: string | null;
  onDismissContext?: () => void;
  capabilities?: ChatCapabilities;
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
    };
  }
  return {
    translate: 'Translate',
    sync: 'Sync translations',
    prompts: 'Saved Prompts',
    placeholder: 'Type a message\u2026',
    send: 'Send',
  };
};

const DEFAULT_CAPS: ChatCapabilities = { is_anonymous: true, can_edit: false, features: [] };

const Composer: React.FC<Props> = ({
  onSend,
  onTranslateClick,
  onSyncClick,
  onPromptsClick,
  outdatedCount = 0,
  disabled,
  uiLanguage,
  contextMode,
  contextLabel,
  onDismissContext,
  capabilities = DEFAULT_CAPS,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [text, setText] = useState('');
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = getComposerLabels(uiLanguage);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setText('');
  };

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
      {contextLabel && (
        <div className="kyra-ai-chat__composer-context">
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
        <button
          type="button"
          className="kyra-ai-chat__composer-send-button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          aria-label={t.send}
          title={t.send}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Composer;
