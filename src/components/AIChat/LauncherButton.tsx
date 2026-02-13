import React from 'react';

type Props = {
  onClick: () => void;
  isOpen: boolean;
  customIcon?: string | null;
  customIconColor?: string;
  badgeCount?: number;
};

const isSvgDataUrl = (url: string) =>
  url.startsWith('data:image/svg');

const LauncherButton: React.FC<Props> = ({
  onClick,
  isOpen,
  customIcon,
  customIconColor,
  badgeCount = 0,
}) => {
  return (
    <button
      type="button"
      className={`kyra-ai-chat__launcher${
        isOpen ? ' kyra-ai-chat__launcher--open' : ''
      }`}
      onClick={onClick}
      aria-label={isOpen ? 'Close translation panel' : 'Open translation panel'}
    >
      {customIcon ? (
        isSvgDataUrl(customIcon) ? (
          <span
            className="kyra-ai-chat__launcher-custom-icon kyra-ai-chat__launcher-custom-icon--svg"
            style={{
              WebkitMaskImage: `url(${customIcon})`,
              maskImage: `url(${customIcon})`,
              backgroundColor: customIconColor || '#ffffff',
            }}
          />
        ) : (
          <img
            src={customIcon}
            alt=""
            className="kyra-ai-chat__launcher-custom-icon"
          />
        )
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l6 6" />
          <path d="M4 14l6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="M22 22l-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
      )}
      {badgeCount > 0 && (
        <span className="kyra-ai-chat__launcher-badge">{badgeCount}</span>
      )}
    </button>
  );
};

export default LauncherButton;
