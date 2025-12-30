import React, { useState } from 'react';

type Props = {
  onSend: (content: string) => void;
  onUpload?: (file: File) => void;
  attachments?: Array<{ file_id: string; name?: string }>;
  onRemoveAttachment?: (file_id: string) => void;
  disabled?: boolean;
  rows?: number;
};

const Composer: React.FC<Props> = ({
  onSend,
  onUpload,
  attachments = [],
  onRemoveAttachment,
  disabled,
  rows = 4,
}) => {
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
      {attachments.length ? (
        <div className="kyra-ai-chat__composer-attachments">
          {attachments.map((file) => (
            <span key={file.file_id} className="kyra-ai-chat__composer-chip">
              {file.name || 'Upload'}
              {onRemoveAttachment ? (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(file.file_id)}
                  aria-label="Remove file"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      <div className="kyra-ai-chat__composer-footer">
        <label className="kyra-ai-chat__composer-action">
          Upload file
          <input
            type="file"
            hidden
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && onUpload) {
                onUpload(file);
                event.target.value = '';
              }
            }}
          />
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
