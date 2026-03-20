// .jsx — should be .tsx like the rest of the project.
import React, { useState, useRef, useEffect } from 'react';
import { useSlate } from 'slate-react';
import { Editor, Transforms } from 'slate';
import { useSelector } from 'react-redux';
import ToolbarButton from '@plone/volto-slate/editor/ui/ToolbarButton';
import AIAssistantButton from './AIAssistantButton';
import { Icon } from '@plone/volto/components';
import { aichatSVG, aiSVG, sendSVG } from '../../helpers/icons';
import { useIntl } from 'react-intl';

// This is the example UUID from RFC 4122. All users share this ID for custom prompts.
// Use crypto.randomUUID().
const CUSTOM_PROMPT_UUID = '123e4567-e89b-12d3-a456-426614174000';

// Injects a <style> element into the DOM manually, bypasses scss.
// Should use a .scss file in the theme folder instead.
const ensureKyraAIStyles = () => {
  if (document.getElementById('kyra-ai-style')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'kyra-ai-style';
  styleEl.innerHTML = `
    body.kyra-ai-running .block .block.slate.selected {
      position: relative;
    }

    body.kyra-ai-running .block .block.slate.selected::before,
    body.kyra-ai-running .block .block.slate.selected:hover::before {
      background-color: #fff5d6 !important;
      border-color: #f1a637 !important;
      outline: 2px solid #f1a637 !important;
      animation: kyra-ai-pulse 1.1s ease-in-out infinite;
      transform-origin: center center;
    }

    body.kyra-ai-running .block .block.slate.selected::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #f1a637;
      border-top-color: transparent;
      border-left-color: transparent;
      right: 12px;
      bottom: 10px;
      z-index: 2;
      pointer-events: none;
      animation: kyra-ai-spinner 0.7s linear infinite;
    }

    @keyframes kyra-ai-pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(241, 166, 55, 0.0);
      }
      50% {
        transform: scale(1.03);
        box-shadow: 0 0 0 8px rgba(241, 166, 55, 0.3);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(241, 166, 55, 0.0);
      }
    }

    @keyframes kyra-ai-spinner {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
};

// ~610 lines — similar to ChatWidgetProvider (~1500 lines) this component does too much:
const AIAssistantSlateButton = () => {
  const intl = useIntl(); // Same react-intl bypass as AIAssistantButton.jsx.
  const locale = (intl.locale || 'en').toLowerCase();
  const isDe = locale.startsWith('de');
  const t = (en, de) => (isDe && de ? de : en);

  const token = useSelector((state) => state?.userSession?.token);

  const [isPromptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResult, setChatResult] = useState(null);

  const editor = useSlate();
  const wrapperRef = useRef(null);

  useEffect(() => {
    ensureKyraAIStyles();
  }, []);

  useEffect(() => {
    if (isRunning) {
      document.body.classList.add('kyra-ai-running');
    } else {
      document.body.classList.remove('kyra-ai-running');
    }
    return () => {
      document.body.classList.remove('kyra-ai-running');
    };
  }, [isRunning]);

  useEffect(() => {
    if (!status || status.type !== 'success') return;
    const tmo = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(tmo);
  }, [status]);

  // Same manual click-outside pattern as ChatPanel.tsx, Composer.tsx, HistoryDrawer.tsx.
  // Consider useRef + onBlur, or extract a shared useClickOutside hook.
  useEffect(() => {
    if (!isPromptDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setPromptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPromptDropdownOpen]);

  const getSelectionText = () => {
    try {
      if (editor.selection) return Editor.string(editor, editor.selection);
    } catch (e) {
      // Silent error — same pattern as PromptsPanel.tsx. At minimum should log.
    }
    return '';
  };

  const applyResultToEditor = (resultText = '', actionType = 'replace') => {
    if (!resultText) return;

    if (!editor.selection) {
      editor.insertText(resultText);
      return;
    }

    if (actionType === 'append') {
      Transforms.collapse(editor, { edge: 'end' });
      editor.insertText(resultText);
    } else {
      Transforms.delete(editor);
      editor.insertText(resultText);
    }
  };

  // Better than the regex in MessageList.tsx, but setting .innerHTML with untrusted content can trigger side effects.
  // Creates a new DOM element on every call. Consider DOMPurify.
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const runPrompt = async ({ prompt, customText, preview = false }) => {
    const selectionText = getSelectionText();
    const isCustom = !prompt;
    const lang = isDe ? 'de' : 'en';

    const promptPayload = isCustom
      ? {
          id: CUSTOM_PROMPT_UUID,
          name: customText?.slice(0, 60) || t('Custom instruction', 'Eigene Anweisung'), // Not translated
          text: customText,
          actionType: 'replace',
          categories: ['Custom'],
        }
      : prompt;

    setIsRunning(true);
    setStatus({ type: 'running', promptName: promptPayload.name });

    try {
      const body = {
        prompt: {
          id: promptPayload.id,
          name: promptPayload.name,
          text: promptPayload.text,
          actionType: promptPayload.actionType,
          categories: promptPayload.categories,
        },
        selection: selectionText,
        language: lang,
      };

      // Direct fetch() instead of using shared API layer from ../AIChat/api. Duplicates auth header logic.
      const response = await fetch('/++api++/@ai-assistant-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('AI assistant run failed:', text);
        setStatus({ type: 'error', promptName: promptPayload.name });
        return;
      }

      const data = await response.json();

      // Tries 8 different property names hoping one matches — indicates an undefined API pattern.
      const rawResult =
        data.result ||
        data.text ||
        data.output ||
        data.result_text ||
        (data.raw &&
          (data.raw.result ||
            data.raw.response ||
            data.raw.text ||
            data.raw.output ||
            data.raw.completion)) ||
        '';

      // Custom HTML detection — same pattern of hand-rolled parsers throughout (stripHtml, renderMarkdown in MessageList.tsx).
      const looksLikeHtml =
        typeof rawResult === 'string' && /<\/?[a-z][\s\S]*>/i.test(rawResult);

      const resultText = looksLikeHtml ? stripHtml(rawResult) : rawResult;

      const actionType = data.actionType || promptPayload.actionType || 'replace';

      if (preview) {
        setChatResult({ text: resultText, actionType });
      } else {
        applyResultToEditor(resultText, actionType);
      }

      setStatus({ type: 'success', promptName: promptPayload.name });
    } catch (e) {
      console.error('AI assistant run failed', e);
      setStatus({ type: 'error', promptName: prompt?.name || null });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSelectPrompt = async (prompt) => {
    setPromptDropdownOpen(false);
    await runPrompt({ prompt, preview: false });
  };

  const handleOpenCustomChat = () => {
    setPromptDropdownOpen(false);
    setChatOpen(true);
    setChatResult(null);
  };

  const handleSubmitCustomPrompt = async () => {
    if (!chatInput.trim()) return;
    setChatResult(null);
    await runPrompt({ customText: chatInput, preview: true });
    setChatInput('');
  };

  const handleInsertFromPreview = () => {
    if (!chatResult) return;
    applyResultToEditor(chatResult.text, chatResult.actionType || 'replace');
    setChatOpen(false);
    setChatResult(null);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setChatResult(null);
  };

  // renderStatusMessage + renderChatOverlay = ~240 lines of inline styles with hardcoded colors.
  // Same inline-styles issue as AIAssistantButton but more extreme. Should use SCSS.
  const renderStatusMessage = () => {
    if (!status) return null;

    let bg = '#e3f2fd';
    let border = '#90caf9';
    let color = '#0d47a1';
    let icon = '\u23f3';
    let text = t(
      'AI instruction is being processed\u2026 This may take a moment.',
      'KI-Anweisung wird verarbeitet\u2026 Dies kann einen Moment dauern.',
    );

    if (status.type === 'success') {
      bg = '#e8f5e9';
      border = '#a5d6a7';
      color = '#1b5e20';
      icon = '\u2714';
      text = status.promptName
        ? t(
            '"{name}" applied successfully.',
            '"{name}" erfolgreich angewendet.',
          ).replace('{name}', status.promptName)
        : t(
            'Instruction applied successfully.',
            'Anweisung erfolgreich angewendet.',
          );
    } else if (status.type === 'error') {
      bg = '#ffebee';
      border = '#ef9a9a';
      color = '#b71c1c';
      icon = '\u26a0';
      text = t(
        'Error while processing the AI instruction.',
        'Fehler bei der Verarbeitung der KI-Anweisung.',
      );
    }

    return (
      <div
        className="kyra-ai-status"
        style={{
          position: 'absolute',
          top: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: 280,
          maxWidth: 520,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.85rem',
          color,
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.14)',
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
      >
        <span style={{ marginRight: 8, fontSize: '0.9rem' }}>{icon}</span>
        <span style={{ flex: 1 }}>{text}</span>
        <button
          type="button"
          onClick={() => setStatus(null)}
          style={{
            marginLeft: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
          }}
        >
          {'\u00d7'}
        </button>
      </div>
    );
  };

  const renderChatOverlay = () => {
    if (!chatOpen) return null;

    return (
      <div
        className="kyra-ai-chat-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 11000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '0 12px 24px 12px',
        }}
      >
        <div
          className="kyra-ai-chat-card"
          style={{
            marginBottom: 16,
            width: 'min(860px, 100%)',
            background: '#ffffff',
            borderRadius: 14,
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
            padding: '16px 18px 14px 18px',
            pointerEvents: 'auto',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            fontSize: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
              {t('AI Assistant', 'AI Assistant')}
            </div>
            <button
              type="button"
              onClick={handleCloseChat}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
              }}
            >
              {'\u00d7'}
            </button>
          </div>

          {chatResult && (
            <>
              <div
                className="kyra-ai-chat-preview"
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 6,
                  maxHeight: 260,
                  overflowY: 'auto',
                  fontSize: '1rem',
                  lineHeight: 1.5,
                  background: 'radial-gradient(circle at top left, #f8fafc 0, #ffffff 40%)',
                }}
              >
                {chatResult.text}
              </div>

              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {t('AI responses can be inaccurate', 'KI-Antworten k\u00f6nnen ungenau sein')}
                </span>
              </div>
            </>
          )}

          <div
            className="kyra-ai-chat-inputrow"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: chatResult ? 0 : 4,
            }}
          >
            <input
              type="text"
              placeholder={t(
                'Instruct the AI to edit or generate something\u2026',
                'KI anweisen, etwas zu bearbeiten oder zu generieren\u2026',
              )}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isRunning) {
                    handleSubmitCustomPrompt();
                  }
                }
              }}
              style={{
                flex: 1,
                border: '1px solid #cbd5f5',
                borderRadius: 999,
                padding: '10px 16px',
                fontSize: '1rem',
                outline: 'none',
                backgroundColor: '#f8fafc',
              }}
            />
            <button
              type="button"
              onClick={handleSubmitCustomPrompt}
              disabled={isRunning || !chatInput.trim()}
              style={{
                minWidth: 56,
                border: '1px solid #1f7ae0',
                borderRadius: 999,
                background: isRunning || !chatInput.trim() ? '#9cbcf4' : '#0094d4',
                cursor: isRunning || !chatInput.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 14px',
              }}
            >
              <Icon name={sendSVG} size="20px" className="kyra-ai-send-icon" />
            </button>
          </div>

          {chatResult && (
            <div
              className="kyra-ai-chat-actions"
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                justifyContent: 'flex-start',
              }}
            >
              <button
                type="button"
                onClick={handleInsertFromPreview}
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: '1px solid #1f7ae0',
                  background: '#0094d4',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('Insert', 'Einf\u00fcgen')}
              </button>
              <button
                type="button"
                onClick={handleSubmitCustomPrompt}
                // Possibly disable while request is in flight.
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {t('Try again', 'Nochmals versuchen')}
              </button>
              <button
                type="button"
                onClick={handleCloseChat}
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: '1px solid transparent',
                  background: 'transparent',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                {t('Close', 'Schlie\u00dfen')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className={`ai-slate-wrapper${isRunning ? ' ai-slate-wrapper--running' : ''}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* onMouseDown with preventDefault breaks keyboard accessibility — users can't trigger via Enter/Space. Should use onClick. */}
      <ToolbarButton
        title={
          isRunning
            ? t('AI Assistant \u2013 generating answer \u2026', 'AI Assistant \u2013 Antwort wird generiert \u2026')
            : t('AI Assistant', 'AI Assistant')
        }
        icon={aiSVG}
        className={isRunning ? 'ai-toolbar-button ai-toolbar-button--running' : 'ai-toolbar-button'}
        onMouseDown={(e) => {
          e.preventDefault();
          if (isRunning) return;
          setChatOpen(false);
          setPromptDropdownOpen((prev) => !prev);
        }}
      />

      {/* Same onMouseDown issue. */}
      <ToolbarButton
        title={t('AI Assistant \u2013 free text', 'AI Assistant \u2013 Freitext')}
        icon={aichatSVG}
        onMouseDown={(e) => {
          e.preventDefault();
          if (isRunning) return;
          setPromptDropdownOpen(false);
          handleOpenCustomChat();
        }}
      />

      {isPromptDropdownOpen && !isRunning && (
        <div
          className="ai-slate-dropdown"
          style={{
            position: 'absolute',
            top: '32px',
            right: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 9999,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
          }}
        >
          <AIAssistantButton onSelectPrompt={handleSelectPrompt} />
        </div>
      )}

      {renderStatusMessage()}
      {renderChatOverlay()}
    </div>
  );
};

export default AIAssistantSlateButton;
