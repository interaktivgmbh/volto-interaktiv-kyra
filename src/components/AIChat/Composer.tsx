import React, { useState } from 'react';

type Props = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

const Composer: React.FC<Props> = ({ onSend, disabled }) => {
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
        rows={2}
        disabled={disabled}
      />
      <button
        type="button"
        className="kyra-ai-chat__send"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
};

export default Composer;
