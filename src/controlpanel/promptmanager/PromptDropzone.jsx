import React, { useRef, useState, useCallback } from 'react';
import { Icon } from 'semantic-ui-react';

const PromptDropzone = ({
  id,
  label,
  message,
  files = [],
  onFilesSelected,
}) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileSelection = useCallback(
    (fileList) => {
      const items = Array.from(fileList || []);
      if (items.length && onFilesSelected) {
        onFilesSelected(items);
      }
    },
    [onFilesSelected],
  );

  const handleInputChange = useCallback(
    (event) => {
      handleFileSelection(event.target.files);
      event.target.value = null;
    },
    [handleFileSelection],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      handleFileSelection(event.dataTransfer.files);
    },
    [handleFileSelection],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const dropzoneClassName = `prompt-manager__dropzone${
    isDragging ? ' prompt-manager__dropzone--active' : ''
  }`;

  return (
    <div className="prompt-manager__dropzone-wrapper">
      <label className="prompt-manager__label" htmlFor={id}>
        {label}
      </label>

      <div
        className={dropzoneClassName}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Icon name="upload" />
        <p className="prompt-manager__dropzone-text">{message}</p>
      </div>

      <input
        id={id}
        ref={inputRef}
        type="file"
        multiple
        className="prompt-manager__file-input"
        onChange={handleInputChange}
      />

      {files.length > 0 && (
        <div className="prompt-manager__file-grid" data-testid={`${id}-files`}>
          {files.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="prompt-manager__file-card"
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="prompt-manager__file-thumb"
                />
              ) : (
                <div className="prompt-manager__file-icon">
                  <Icon name="file outline" />
                </div>
              )}
              <span title={item.file.name}>{item.file.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptDropzone;
