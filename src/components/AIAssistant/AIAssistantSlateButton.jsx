import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSlate } from 'slate-react';
import { Editor, Transforms, Text, Range, Node } from 'slate';
import { useSelector } from 'react-redux';
import ToolbarButton from '@plone/volto-slate/editor/ui/ToolbarButton';
import AIAssistantButton from './AIAssistantButton';
import { Icon } from '@plone/volto/components';
import { aichatSVG, aiSVG, sendSVG } from '../../helpers/icons';
import { useIntl } from 'react-intl';

const CUSTOM_PROMPT_UUID = '123e4567-e89b-12d3-a456-426614174000';

const parseHighlightWords = (text) => {
  if (!text) return [];
  let body = text;
  const markers = ['Relevant Context:', 'Füllwörter:', 'Filler words:', 'Markierte Wörter:', 'Ergebnis:', 'Gefundene Wörter:', 'Wörter:'];
  for (const marker of markers) {
    const idx = body.indexOf(marker);
    if (idx !== -1) {
      body = body.substring(idx + marker.length);
      break;
    }
  }
  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const words = [];
  for (const line of lines) {
    const parts = line.split(/[,;]+/).map((w) => w.replace(/^[-•*\d.)\s"„"»«]+/, '').replace(/["„"»«]+$/, '').trim());
    for (const p of parts) {
      if (p.length >= 2 && p.length <= 40 && p.split(/\s+/).length <= 3) {
        words.push(p);
      }
    }
  }
  return [...new Set(words)];
};

const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

let globalHighlightWords = [];
let globalHighlightColor = '#fde68a';
let globalHighlightEditor = null;

export const kyraHighlightDecorate = (editor, [node, path], acc = []) => {
  if (!Text.isText(node) || globalHighlightWords.length === 0) return acc;
  if (globalHighlightEditor && editor !== globalHighlightEditor) return acc;
  const { text } = node;
  const lower = text.toLowerCase();
  const ranges = [...acc];
  for (const word of globalHighlightWords) {
    const wLower = word.toLowerCase();
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(wLower, idx);
      if (found === -1) break;
      ranges.push({
        anchor: { path, offset: found },
        focus: { path, offset: found + word.length },
        kyraHighlight: true,
        kyraHighlightColor: globalHighlightColor,
      });
      idx = found + word.length;
    }
  }
  return ranges;
};

const AIAssistantSlateButton = () => {
  const intl = useIntl();
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
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightCount, setHighlightCount] = useState(0);

  const editor = useSlate();
  const wrapperRef = useRef(null);

  useEffect(() => {
    return () => {
      globalHighlightWords = [];
      globalHighlightColor = '#fde68a';
      globalHighlightEditor = null;
    };
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
      // ignore
    }
    return '';
  };

  const applyHighlights = useCallback((words, color) => {
    globalHighlightWords = words;
    globalHighlightColor = color || '#fde68a';
    globalHighlightEditor = editor;
    let matches = 0;
    const fullText = Editor.string(editor, []).toLowerCase();
    for (const w of words) {
      const wl = w.toLowerCase();
      let idx = 0;
      while (idx < fullText.length) {
        const found = fullText.indexOf(wl, idx);
        if (found === -1) break;
        matches++;
        idx = found + wl.length;
      }
    }
    setHighlightActive(true);
    setHighlightCount(matches);
    editor.onChange();
  }, [editor]);

  const clearHighlights = useCallback(() => {
    globalHighlightWords = [];
    globalHighlightEditor = null;
    setHighlightActive(false);
    setHighlightCount(0);
    editor.onChange();
  }, [editor]);

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
          name: customText?.slice(0, 60) || t('Custom instruction', 'Eigene Anweisung'),
          text: customText,
          actionType: 'replace',
          categories: ['Custom'],
        }
      : prompt;

    setIsRunning(true);
    setStatus({ type: 'running', promptName: promptPayload.name });

    try {
      const isHighlight = promptPayload.actionType === 'highlight';
      const promptText = isHighlight
        ? `${promptPayload.text}\n\nIMPORTANT: Return ONLY a comma-separated list of the identified words/phrases from the text. Nothing else — no explanations, no numbering, no sentences, no quotes. Just the raw words separated by commas.`
        : promptPayload.text;

      const body = {
        prompt: {
          id: promptPayload.id,
          name: promptPayload.name,
          text: promptText,
          actionType: isHighlight ? 'replace' : promptPayload.actionType,
          categories: promptPayload.categories,
        },
        selection: selectionText,
        language: lang,
      };

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

      const looksLikeHtml =
        typeof rawResult === 'string' && /<\/?[a-z][\s\S]*>/i.test(rawResult);

      const resultText = looksLikeHtml ? stripHtml(rawResult) : rawResult;

      const actionType = isHighlight ? 'highlight' : (data.actionType || promptPayload.actionType || 'replace');

      if (actionType === 'highlight') {
        const words = data.highlights || parseHighlightWords(resultText);
        if (words.length > 0) {
          const colorIndex = Math.floor(Math.random() * HIGHLIGHT_COLORS.length);
          applyHighlights(words, data.highlightColor || HIGHLIGHT_COLORS[colorIndex]);
        }
      } else if (preview) {
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
          background: bg,
          border: `1px solid ${border}`,
          color,
        }}
      >
        <span className="kyra-ai-status__icon">{icon}</span>
        <span className="kyra-ai-status__text">{text}</span>
        <button
          type="button"
          onClick={() => setStatus(null)}
          className="kyra-ai-status__close"
        >
          {'\u00d7'}
        </button>
      </div>
    );
  };

  const renderChatOverlay = () => {
    if (!chatOpen) return null;

    return (
      <div className="kyra-ai-chat-overlay">
        <div className="kyra-ai-chat-card">
          <div className="kyra-ai-chat-card__header">
            <div className="kyra-ai-chat-card__title">
              {t('AI Assistant', 'AI Assistant')}
            </div>
            <button
              type="button"
              onClick={handleCloseChat}
              className="kyra-ai-chat-card__close"
            >
              {'\u00d7'}
            </button>
          </div>

          {chatResult && (
            <>
              <div className="kyra-ai-chat-preview">
                {chatResult.text}
              </div>

              <div className="kyra-ai-chat-preview__disclaimer">
                <span className="kyra-ai-chat-preview__disclaimer-text">
                  {t('AI responses can be inaccurate', 'KI-Antworten k\u00f6nnen ungenau sein')}
                </span>
              </div>
            </>
          )}

          <div
            className={`kyra-ai-chat-inputrow ${chatResult ? 'kyra-ai-chat-inputrow--with-preview' : 'kyra-ai-chat-inputrow--no-preview'}`}
          >
            <input
              type="text"
              className="kyra-ai-chat-inputrow__input"
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
            />
            <button
              type="button"
              onClick={handleSubmitCustomPrompt}
              disabled={isRunning || !chatInput.trim()}
              className={`kyra-ai-chat-inputrow__send ${isRunning || !chatInput.trim() ? 'kyra-ai-chat-inputrow__send--disabled' : 'kyra-ai-chat-inputrow__send--active'}`}
            >
              <Icon name={sendSVG} size="20px" className="kyra-ai-send-icon" />
            </button>
          </div>

          {chatResult && (
            <div className="kyra-ai-chat-actions">
              <button
                type="button"
                onClick={handleInsertFromPreview}
                className="kyra-ai-chat-actions__insert"
              >
                {t('Insert', 'Einf\u00fcgen')}
              </button>
              <button
                type="button"
                onClick={handleSubmitCustomPrompt}
                className="kyra-ai-chat-actions__retry"
              >
                {t('Try again', 'Nochmals versuchen')}
              </button>
              <button
                type="button"
                onClick={handleCloseChat}
                className="kyra-ai-chat-actions__close"
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
    <>
    {highlightActive && (
      <div className="kyra-highlight-banner">
        <span>{highlightCount} {isDe ? 'Markierungen' : 'highlights'}</span>
        <button type="button" onClick={clearHighlights}>✕</button>
      </div>
    )}
    <div
      ref={wrapperRef}
      className={`ai-slate-wrapper${isRunning ? ' ai-slate-wrapper--running' : ''}`}
    >
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
        <div className="ai-slate-dropdown">
          <AIAssistantButton onSelectPrompt={handleSelectPrompt} />
        </div>
      )}

      {renderStatusMessage()}
      {renderChatOverlay()}
    </div>
    </>
  );
};

export default AIAssistantSlateButton;
