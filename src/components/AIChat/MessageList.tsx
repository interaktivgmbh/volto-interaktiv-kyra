import React, { useMemo, useState } from 'react';

import type {ChatMessage} from './types';

type Props = {
  messages: ChatMessage[];
  onRegenerate?: (message: ChatMessage) => void;
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').trim();

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

const MessageList: React.FC<Props> = ({ messages, onRegenerate }) => {
  const rendered = useMemo(() => messages, [messages]);
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
    <div className="kyra-ai-chat__messages">
      {rendered.map((message) => {
        const isAssistant = message.role === 'assistant';
        const isStreaming = message.status === 'streaming';
        const isError = message.status === 'error';
        const displayContent =
          stripHtml(message.content || '') ||
          (isStreaming ? '...' : isError ? 'Error' : '');
        return (
          <div
            key={message.id}
            className={`kyra-ai-chat__message kyra-ai-chat__message--${message.role}${
              message.status ? ` kyra-ai-chat__message--${message.status}` : ''
            }`}
          >
            <div className="kyra-ai-chat__message-bubble">
              <div className="kyra-ai-chat__message-content">
                {displayContent}
              </div>
            </div>
            {isAssistant && !isStreaming && (
              <div className="kyra-ai-chat__message-actions-row">
                <button
                  type="button"
                  className={`kyra-ai-chat__icon-button${
                    copiedId === message.id ? ' is-active' : ''
                  }`}
                  onClick={() => handleCopy(message.id, displayContent)}
                  aria-label="Copy message"
                  title={copiedId === message.id ? 'Copied' : 'Copy'}
                >
                  {copiedId === message.id ? <IconCheck /> : <IconCopy />}
                </button>
                {onRegenerate && (
                  <button
                    type="button"
                    className="kyra-ai-chat__icon-button"
                    aria-label="Regenerate"
                    title="Run again"
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
                  aria-label="Thumb up"
                  title="Mark helpful"
                  onClick={() => handleFeedback(message.id, 'up')}
                >
                  <IconThumbUp />
                </button>
                <button
                  type="button"
                  className={`kyra-ai-chat__icon-button${
                    feedback[message.id] === 'down' ? ' is-active' : ''
                  }`}
                  aria-label="Thumb down"
                  title="Mark not helpful"
                  onClick={() => handleFeedback(message.id, 'down')}
                >
                  <IconThumbDown />
                </button>
              </div>
            )}
            {isAssistant && message.citations && message.citations.length > 0 && (
              <details className="kyra-ai-chat__citations">
                <summary>Sources</summary>
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
