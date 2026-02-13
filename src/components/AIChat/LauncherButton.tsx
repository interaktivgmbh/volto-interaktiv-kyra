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
            className="kyra-ai-chat__launcher-custom-icon"
            style={{
              WebkitMaskImage: `url(${customIcon})`,
              maskImage: `url(${customIcon})`,
              backgroundColor: customIconColor || '#ffffff',
              width: 18,
              height: 18,
              display: 'block',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
        ) : (
          <img
            src={customIcon}
            alt=""
            style={{ width: 18, height: 18, objectFit: 'contain' }}
          />
        )
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
