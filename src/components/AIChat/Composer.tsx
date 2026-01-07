import React, { useState, useEffect, useRef } from 'react';

import { Icon } from '@plone/volto/components';
import { microphoneSVG } from '../../helpers/icons';

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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  useEffect(() => {
    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;
    setSpeechSupported(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          setValue((prev) => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            return `${prev}${separator}${transcript}`.trimEnd();
          });
          interimTranscript = '';
        } else {
          interimTranscript += transcript;
        }
      }
      if (interimTranscript) {
        setValue((prev) => {
          const base = prev.replace(/[\u00A0]+$/, '');
          const separator = base && !base.endsWith(' ') ? ' ' : '';
          return `${base}${separator}${interimTranscript}`;
        });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.stop();
    };
  }, []);

  const handleMicToggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition || disabled) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    try {
      recognition.start();
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
    }
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
            className={`kyra-ai-chat__composer-icon-button${
              isListening ? ' is-listening' : ''
            }`}
            aria-label={isListening ? 'Stop recording' : 'Record voice'}
            disabled={!speechSupported || disabled}
            onClick={handleMicToggle}
          >
            <Icon name={microphoneSVG} size="18px" />
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
