import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from './types';

type Props = {
  messages: ChatMessage[];
  onRegenerate?: (message: ChatMessage) => void;
  uiLanguage?: string;
};

const getMessageLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      copy: 'Kopieren',
      copied: 'Kopiert',
      runAgain: 'Erneut ausführen',
      helpful: 'Hilfreich',
      notHelpful: 'Nicht hilfreich',
      sources: 'Quellen',
      error: 'Fehler',
    };
  }
  return {
    copy: 'Copy',
    copied: 'Copied',
    runAgain: 'Run again',
    helpful: 'Mark helpful',
    notHelpful: 'Mark not helpful',
    sources: 'Sources',
    error: 'Error',
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

const copyToClipboard = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (_err) {
    // ignore clipboard errors
  }
};

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M21 12a9 9 0 0 1-9 9 9.002 9.002 0 0 1-8.485-6M3 12a9 9 0 0 1 9-9 9.002 9.002 0 0 1 8.485 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M3 4v6h6M21 20v-6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconThumbUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 11v8m0-8L12.5 3a1 1 0 0 1 1.7.96L13 10h6a2 2 0 0 1 1.94 2.45l-1.2 5A2 2 0 0 1 17.8 19H9a2 2 0 0 1-2-2v-6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconThumbDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 13V5m0 8L12.5 21a1 1 0 0 0 1.7-.96L13 14h6a2 2 0 0 0 1.94-2.45l-1.2-5A2 2 0 0 0 17.8 5H9a2 2 0 0 0-2 2v6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M20 6L9 17l-5-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MessageList: React.FC<Props> = ({ messages, onRegenerate, uiLanguage }) => {
  const rendered = useMemo(() => messages, [messages]);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = getMessageLabels(uiLanguage);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | null>>(
    {},
  );

  const handleCopy = (id: string, text: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2500);
  };

  const handleFeedback = (id: string, value: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [id]: prev[id] === value ? null : value }));
  };

  return (
    <div className="kyra-ai-chat__messages" ref={containerRef}>
      {rendered.map((message) => {
        const isAssistant = message.role === 'assistant';
        const isStreaming = message.status === 'streaming';
        const isError = message.status === 'error';
        const rawContent =
          stripHtml(message.content || '') ||
          (isStreaming ? '...' : isError ? t.error : '');
        const useMarkdown = isAssistant && !isStreaming && !isError;
        return (
          <div
            key={message.id}
            className={`kyra-ai-chat__message kyra-ai-chat__message--${message.role}${
              message.status ? ` kyra-ai-chat__message--${message.status}` : ''
            }`}
          >
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
            {isAssistant && !isStreaming && (
              <div className="kyra-ai-chat__message-actions-row">
                <button
                  type="button"
                  className={`kyra-ai-chat__icon-button${
                    copiedId === message.id ? ' is-active' : ''
                  }`}
                  onClick={() => handleCopy(message.id, rawContent)}
                  aria-label={t.copy}
                  title={copiedId === message.id ? t.copied : t.copy}
                >
                  {copiedId === message.id ? <IconCheck /> : <IconCopy />}
                </button>
                {onRegenerate && (
                  <button
                    type="button"
                    className="kyra-ai-chat__icon-button"
                    aria-label={t.runAgain}
                    title={t.runAgain}
                    onClick={() => onRegenerate(message)}
                  >
                    <IconRefresh />
                  </button>
                )}
                <button
                  type="button"
                  className={`kyra-ai-chat__icon-button${
                    feedback[message.id] === 'up' ? ' is-active' : ''
                  }`}
                  aria-label={t.helpful}
                  title={t.helpful}
                  onClick={() => handleFeedback(message.id, 'up')}
                >
                  <IconThumbUp />
                </button>
                <button
                  type="button"
                  className={`kyra-ai-chat__icon-button${
                    feedback[message.id] === 'down' ? ' is-active' : ''
                  }`}
                  aria-label={t.notHelpful}
                  title={t.notHelpful}
                  onClick={() => handleFeedback(message.id, 'down')}
                >
                  <IconThumbDown />
                </button>
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
