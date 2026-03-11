import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from './types';

type Props = {
  messages: ChatMessage[];
  onAction?: (messageId: string, value: string) => void;
  uiLanguage?: string;
  editingMessageId?: string | null;
  onEditAndResend?: (messageId: string, newText: string) => void;
  onCancelEdit?: () => void;
};

const getMessageLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      sources: 'Quellen',
      error: 'Fehler',
      thinking: 'KI denkt nach\u2026',
      promptOriginal: 'Original',
      promptResult: 'Ergebnis',
      editSend: 'Senden',
      editCancel: 'Abbrechen',
    };
  }
  return {
    sources: 'Sources',
    error: 'Error',
    thinking: 'AI is thinking\u2026',
    promptOriginal: 'Original',
    promptResult: 'Result',
    editSend: 'Send',
    editCancel: 'Cancel',
  };
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').trim();

/**
 * Lightweight markdown-to-HTML converter for chat messages.
 * Supports: headings (##), bold (**), italic (*), unordered lists (-),
 * ordered lists (1.), and paragraphs.
 */
const renderMarkdown = (text: string): string => {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const htmlParts: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      htmlParts.push(`<p>${paragraph.join(' ')}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (inList) {
      htmlParts.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  const inlineFormat = (line: string): string => {
    // Bold: **text**
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (but not inside bold)
    line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    return line;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Empty line: flush paragraph
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    // Headings: ## Text or ### Text
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      // Use h3/h4 to keep headings smaller in chat context
      const tag = `h${Math.min(level + 1, 5)}`;
      htmlParts.push(`<${tag}>${inlineFormat(headingMatch[2])}</${tag}>`);
      continue;
    }

    // Unordered list: - item or * item
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inList !== 'ul') {
        closeList();
        htmlParts.push('<ul>');
        inList = 'ul';
      }
      htmlParts.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list: 1. item
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inList !== 'ol') {
        closeList();
        htmlParts.push('<ol>');
        inList = 'ol';
      }
      htmlParts.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // Regular text line: accumulate into paragraph
    closeList();
    paragraph.push(inlineFormat(line));
  }

  flushParagraph();
  closeList();

  return htmlParts.join('');
};

const MessageList: React.FC<Props> = ({
  messages,
  onAction,
  uiLanguage,
  editingMessageId,
  onEditAndResend,
  onCancelEdit,
}) => {
  const rendered = useMemo(() => messages, [messages]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const t = getMessageLabels(uiLanguage);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // When entering edit mode, populate the textarea
  useEffect(() => {
    if (editingMessageId) {
      const msg = messages.find((m) => m.id === editingMessageId);
      if (msg) setEditText(msg.content || '');
      setTimeout(() => editRef.current?.focus(), 50);
    }
  }, [editingMessageId, messages]);

  return (
    <div className="kyra-ai-chat__messages" ref={containerRef}>
      {rendered.map((message) => {
        const isAssistant = message.role === 'assistant';
        const isUser = message.role === 'user';
        const isStreaming = message.status === 'streaming';
        const isError = message.status === 'error';
        const isDone = message.status === 'done' || (!isStreaming && !isError);
        const rawContent =
          stripHtml(message.content || '') ||
          (isStreaming ? '' : isError ? t.error : '');
        const useMarkdown = isAssistant && isDone && !isError;
        const isEditing = isUser && editingMessageId === message.id;

        // Prompt comparison view — show during streaming AND when done
        const isPromptResult =
          isAssistant && !isError && message.wizardMeta?.isPromptResult;
        const originalText = message.wizardMeta?.originalText || '';

        return (
          <div
            key={message.id}
            className={`kyra-ai-chat__message kyra-ai-chat__message--${message.role}${
              message.status ? ` kyra-ai-chat__message--${message.status}` : ''
            }`}
          >
            {/* Inline editing for user messages */}
            {isEditing ? (
              <div className="kyra-ai-chat__message-edit">
                <textarea
                  ref={editRef}
                  className="kyra-ai-chat__message-edit-textarea"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onEditAndResend?.(message.id, editText);
                    }
                    if (e.key === 'Escape') {
                      onCancelEdit?.();
                    }
                  }}
                  rows={3}
                />
                <div className="kyra-ai-chat__message-edit-actions">
                  <button
                    type="button"
                    className="kyra-ai-chat__message-edit-btn kyra-ai-chat__message-edit-btn--send"
                    onClick={() => onEditAndResend?.(message.id, editText)}
                  >
                    {t.editSend}
                  </button>
                  <button
                    type="button"
                    className="kyra-ai-chat__message-edit-btn kyra-ai-chat__message-edit-btn--cancel"
                    onClick={() => onCancelEdit?.()}
                  >
                    {t.editCancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Prompt comparison view — live during streaming + final */}
                {isPromptResult && (
                  <div className="kyra-ai-chat__message-bubble">
                    <div className="kyra-ai-chat__prompt-comparison">
                      {originalText && (
                        <>
                          <div className="kyra-ai-chat__prompt-comparison-label">
                            {t.promptOriginal}
                          </div>
                          <div className="kyra-ai-chat__prompt-comparison--original">
                            {originalText}
                          </div>
                          <div className="kyra-ai-chat__prompt-comparison-divider" />
                        </>
                      )}
                      <div className="kyra-ai-chat__prompt-comparison-label">
                        {t.promptResult}
                        {isStreaming && (
                          <span className="kyra-ai-chat__thinking-dots kyra-ai-chat__thinking-dots--inline">
                            <span /><span /><span />
                          </span>
                        )}
                      </div>
                      {rawContent ? (
                        <div
                          className="kyra-ai-chat__prompt-comparison--result kyra-ai-chat__message-content--markdown"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(rawContent) }}
                        />
                      ) : isStreaming ? (
                        <div className="kyra-ai-chat__prompt-comparison--result kyra-ai-chat__prompt-comparison--placeholder">
                          {t.thinking}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
                {/* Thinking phase: shown while streaming (non-prompt only) */}
                {!isPromptResult && isAssistant && isStreaming && (
                  <div className="kyra-ai-chat__message-thinking">
                    <span className="kyra-ai-chat__message-thinking-label">
                      <span className="kyra-ai-chat__thinking-dots">
                        <span /><span /><span />
                      </span>
                      {rawContent || t.thinking}
                    </span>
                  </div>
                )}
                {/* Regular final answer (non-prompt-result) */}
                {!isPromptResult && !(isAssistant && isStreaming) && (
                  <div className="kyra-ai-chat__message-bubble">
                    {useMarkdown ? (
                      <div
                        className="kyra-ai-chat__message-content kyra-ai-chat__message-content--markdown"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(rawContent) }}
                      />
                    ) : (
                      <div className="kyra-ai-chat__message-content">
                        {rawContent}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {/* Wizard action buttons */}
            {isAssistant && message.actions && message.actions.length > 0 && (
              <div className="kyra-ai-chat__message-wizard-actions">
                {message.actions.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    className={`kyra-ai-chat__message-wizard-btn${
                      action.variant === 'primary'
                        ? ' kyra-ai-chat__message-wizard-btn--primary'
                        : action.variant === 'ghost'
                        ? ' kyra-ai-chat__message-wizard-btn--ghost'
                        : ''
                    }`}
                    onClick={() => onAction?.(message.id, action.value)}
                  >
                    {action.icon === 'page' && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    )}
                    {action.icon === 'folder' && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    )}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
            {isAssistant && message.citations && message.citations.length > 0 && (
              <details className="kyra-ai-chat__citations">
                <summary>{t.sources}</summary>
                <ul>
                  {message.citations.map((citation) => (
                    <li key={citation.source_id}>
                      <a href={citation.url} target="_blank" rel="noreferrer">
                        {citation.label || citation.url}
                      </a>
                      {citation.snippet && (
                        <div className="kyra-ai-chat__citation-snippet">
                          {citation.snippet}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
