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
  customIconColor = '#ffffff',
  badgeCount = 0,
}) => {
  const renderIcon = () => {
    if (!customIcon) {
      return <Icon name={robotSVG} size="18px" />;
    }

    if (isSvgDataUrl(customIcon)) {
      return (
        <span
          className="kyra-ai-chat__launcher-custom-icon kyra-ai-chat__launcher-custom-icon--svg"
          style={{
            WebkitMaskImage: `url(${customIcon})`,
            maskImage: `url(${customIcon})`,
            backgroundColor: customIconColor,
          }}
        />
      );
    }

    return (
      <img
        src={customIcon}
        alt="Kyra AI"
        className="kyra-ai-chat__launcher-custom-icon"
      />
    );
  };

  return (
    <button
      type="button"
      className={`kyra-ai-chat__launcher${
        isOpen ? ' kyra-ai-chat__launcher--open' : ''
      }`}
      onClick={onClick}
      aria-label={isOpen ? 'Close Kyra AI chat' : 'Open Kyra AI chat'}
    >
      {renderIcon()}
      {badgeCount > 0 && (
        <span className="kyra-ai-chat__launcher-badge">{badgeCount}</span>
      )}
    </button>
  );
};

export default LauncherButton;
