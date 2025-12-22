import React from 'react';

type Props = {
  onClick: () => void;
  isOpen: boolean;
};

const LauncherButton: React.FC<Props> = ({ onClick, isOpen }) => {
  return (
    <button
      type="button"
      className={`kyra-ai-chat__launcher${
        isOpen ? ' kyra-ai-chat__launcher--open' : ''
      }`}
      onClick={onClick}
      aria-label={isOpen ? 'Close Kyra AI chat' : 'Open Kyra AI chat'}
    >
      AI
    </button>
  );
};

export default LauncherButton;
