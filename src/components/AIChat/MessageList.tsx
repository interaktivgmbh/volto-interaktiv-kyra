import React, { useMemo } from 'react';

import type { ChatMessage } from './types';

type Props = {
  messages: ChatMessage[];
  onFeedback: (messageId: string, rating: 'up' | 'down') => void;
};

const MessageList: React.FC<Props> = ({ messages, onFeedback }) => {
  const rendered = useMemo(() => messages, [messages]);

  return (
    <div className="kyra-ai-chat__messages">
      {rendered.map((message) => {
        const isAssistant = message.role === 'assistant';
        const isStreaming = message.status === 'streaming';
        const isError = message.status === 'error';
        const displayContent =
          message.content || (isStreaming ? '...' : isError ? 'Error' : '');
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
              {isAssistant && !isStreaming && !isError && (
                <div className="kyra-ai-chat__message-actions">
                  <button
                    type="button"
                    className={`kyra-ai-chat__feedback${
                      message.feedback === 'up'
                        ? ' kyra-ai-chat__feedback--active'
                        : ''
                    }`}
                    onClick={() => onFeedback(message.id, 'up')}
                    aria-label="Mark response helpful"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className={`kyra-ai-chat__feedback${
                      message.feedback === 'down'
                        ? ' kyra-ai-chat__feedback--active'
                        : ''
                    }`}
                    onClick={() => onFeedback(message.id, 'down')}
                    aria-label="Mark response not helpful"
                  >
                    -1
                  </button>
                </div>
              )}
            </div>
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
