import React, { useState, useEffect, useRef } from 'react';

import { Icon } from '@plone/volto/components';
import { translateSVG } from '../../helpers/icons';

type Props = {
  onTranslateClick?: () => void;
  onSyncClick?: () => void;
  outdatedCount?: number;
  disabled?: boolean;
  uiLanguage?: string;
};

const getComposerLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      translate: '\u00dcbersetzen',
      sync: 'Synchronisieren',
    };
  }
  return {
    translate: 'Translate',
    sync: 'Sync translations',
  };
};

const Composer: React.FC<Props> = ({
  onTranslateClick,
  onSyncClick,
  outdatedCount = 0,
  disabled,
  uiLanguage,
}) => {
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const t = getComposerLabels(uiLanguage);

  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  return (
    <div className="kyra-ai-chat__composer">
      <div className="kyra-ai-chat__composer-row">
        <div className="kyra-ai-chat__composer-plus-menu" ref={plusMenuRef}>
          <button
            type="button"
            className="kyra-ai-chat__composer-icon-button"
            onClick={() => setShowPlusMenu((v) => !v)}
            disabled={disabled}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showPlusMenu && (
            <div className="kyra-ai-chat__composer-plus-panel">
              <button
                type="button"
                onClick={() => {
                  onTranslateClick?.();
                  setShowPlusMenu(false);
                }}
              >
                <Icon name={translateSVG} size="20px" />
                <span>{t.translate}</span>
              </button>
              {outdatedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncClick?.();
                    setShowPlusMenu(false);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6" />
                    <path d="M2.5 22v-6h6" />
                    <path d="M2.5 11.5a10 10 0 0 1 16.5-5.3L21.5 8" />
                    <path d="M21.5 12.5a10 10 0 0 1-16.5 5.3L2.5 16" />
                  </svg>
                  <span>{t.sync}</span>
                  <span className="kyra-ai-chat__composer-badge">{outdatedCount}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Composer;
