import React, { useState } from 'react';

type Props = {
  onSend: (content: string) => void;
  disabled?: boolean;
  rows?: number;
};

const Composer: React.FC<Props> = ({ onSend, disabled, rows = 4 }) => {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <div className="kyra-ai-chat__composer">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Ask Kyra AI..."
        rows={rows}
        disabled={disabled}
        style={{
          minHeight: `${rows * 20}px`,
        }}
      />
      <div className="kyra-ai-chat__composer-footer">
        <label className="kyra-ai-chat__composer-action">
          Upload file
          <input type="file" hidden disabled={disabled} />
        </label>
        <div className="kyra-ai-chat__composer-controls">
          <button
            type="button"
            className="kyra-ai-chat__composer-icon-button"
            aria-label="Record voice"
          >
            <span />
          </button>
          <button
            type="button"
            className="kyra-ai-chat__send"
            onClick={submit}
            disabled={disabled || value.trim().length === 0}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Composer;
