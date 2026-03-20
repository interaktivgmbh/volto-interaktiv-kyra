import React from 'react';
import { Icon } from '@plone/volto/components';
import { robotSVG } from '../../helpers/icons';

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
      aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
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
        <Icon name={robotSVG} size="36px" />
      )}
      {badgeCount > 0 && (
        <span className="kyra-ai-chat__launcher-badge">{badgeCount}</span>
      )}
    </button>
  );
};

export default LauncherButton;
