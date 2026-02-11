import React from 'react';

import ActionsTab from './ActionsTab';
import type { ChatCapabilities, ChatContextPayload, TranslationStatus } from './types';

const getLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      title: 'Übersetzung',
      close: 'Schließen',
    };
  }
  return {
    title: 'Translation',
    close: 'Close',
  };
};

type Props = {
  isOpen: boolean;
  capabilities: ChatCapabilities;
  pageContext?: ChatContextPayload;
  onActionsApplied?: (result: { reload?: boolean }) => void;
  translationStatus?: TranslationStatus | null;
  onRefetchTranslationStatus?: () => Promise<void>;
  onClose: () => void;
  uiLanguage?: string;
};

const ChatPanel: React.FC<Props> = ({
  isOpen,
  capabilities,
  pageContext,
  onActionsApplied,
  translationStatus,
  onRefetchTranslationStatus,
  onClose,
  uiLanguage,
}) => {
  if (!isOpen) return null;
  const t = getLabels(uiLanguage);

  return (
    <div className="kyra-ai-chat__panel">
      <div className="kyra-ai-chat__header">
        <div className="kyra-ai-chat__title">
          <div>{t.title}</div>
        </div>
        <div className="kyra-ai-chat__header-actions">
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
