import React from 'react';

import ActionsTab from './ActionsTab';
import type { ChatCapabilities, ChatContextPayload, TranslationStatus } from './types';

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Volto AI Assistant',
      close: 'Schließen',
      dock: 'Andocken',
      undock: 'Abdocken',
    };
  }
  return {
    title: 'Volto AI Assistant',
    close: 'Close',
    dock: 'Dock',
    undock: 'Undock',
  };
};

type Props = {
  isOpen: boolean;
  isDocked: boolean;
  capabilities: ChatCapabilities;
  pageContext?: ChatContextPayload;
  onActionsApplied?: (result: { reload?: boolean }) => void;
  translationStatus?: TranslationStatus | null;
  onRefetchTranslationStatus?: () => Promise<void>;
  onClose: () => void;
  onToggleDock: () => void;
  uiLanguage?: string;
};

const ChatPanel: React.FC<Props> = ({
  isOpen,
  isDocked,
  capabilities,
  pageContext,
  onActionsApplied,
  translationStatus,
  onRefetchTranslationStatus,
  onClose,
  onToggleDock,
  uiLanguage,
}) => {
  if (!isOpen) return null;
  const t = getLabels(uiLanguage);

  return (
    <div className={`kyra-ai-chat__panel${isDocked ? ' kyra-ai-chat__panel--docked' : ''}`}>
      <div className="kyra-ai-chat__header">
        <div className="kyra-ai-chat__title">
          <div>{t.title}</div>
        </div>
        <div className="kyra-ai-chat__header-actions">
          <button type="button" onClick={onToggleDock} title={isDocked ? t.undock : t.dock}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isDocked ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </>
              )}
            </svg>
          </button>
          <button type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
      <div className="kyra-ai-chat__body">
        <ActionsTab
          canEdit={capabilities.can_edit}
          pageContext={pageContext}
          uiLanguage={uiLanguage}
          onApplied={onActionsApplied}
          translationStatus={translationStatus}
          onRefetchTranslationStatus={onRefetchTranslationStatus}
        />
      </div>
    </div>
  );
};

export default ChatPanel;
