import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import ChatPanel from './ChatPanel';
import LauncherButton from './LauncherButton';
import { getAiCapabilities, getTranslationStatus } from './api';
import type { ChatCapabilities, ChatContextPayload, TranslationStatus } from './types';

const DEFAULT_CAPABILITIES: ChatCapabilities = {
  is_anonymous: true,
  can_edit: false,
  features: [],
};

const ChatWidgetProvider: React.FC = () => {
  const userSession = useSelector((state: any) => state.userSession);
  const token = userSession?.token;
  const content = useSelector((state: any) => state.content?.data);

  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [capabilities, setCapabilities] =
    useState<ChatCapabilities>(DEFAULT_CAPABILITIES);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);

  const uiLanguage = useMemo(() => {
    if (typeof document !== 'undefined') {
      const docLang = document.documentElement?.lang;
      if (docLang) return docLang;
    }
    if (typeof navigator !== 'undefined') {
      return navigator.language || 'en';
    }
    return 'en';
  }, []);

  const pageReference = useMemo(() => {
    if (!content) return undefined;
    return {
      page: {
        uid: content?.UID,
        url: content?.['@id'],
      },
    };
  }, [content]);

  const pageContext = useMemo<ChatContextPayload | undefined>(() => {
    if (!pageReference) return undefined;
    return {
      mode: 'page',
      page: pageReference.page,
    };
  }, [pageReference]);

  useEffect(() => {
    if (!pageReference?.page?.url) return;
    let isMounted = true;

    const fetchCapabilities = async () => {
      try {
        const context = pageReference?.page
          ? { uid: pageReference.page.uid, url: pageReference.page.url }
          : undefined;
        const response = await getAiCapabilities(context, token);
        if (isMounted && response) {
          setCapabilities((prev) => ({
            ...prev,
            ...response,
            features: response.features || prev.features || [],
          }));
        }
      } catch (_error) {
        // Ignore capability fetch errors.
      }
    };

    fetchCapabilities();
    return () => {
      isMounted = false;
    };
  }, [pageReference?.page?.uid, pageReference?.page?.url, token]);

  const refetchTranslationStatus = async () => {
    const pageUrl = content?.['@id'];
    if (!pageUrl) {
      setTranslationStatus(null);
      return;
    }
    try {
      const status = await getTranslationStatus(pageUrl, token);
      setTranslationStatus(status);
    } catch (_error) {
      setTranslationStatus(null);
    }
  };

  useEffect(() => {
    const pageUrl = content?.['@id'];
    if (!pageUrl) {
      setTranslationStatus(null);
      return;
    }
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const status = await getTranslationStatus(pageUrl, token);
        if (isMounted) setTranslationStatus(status);
      } catch (_error) {
        if (isMounted) setTranslationStatus(null);
      }
    };
    fetchStatus();
    return () => { isMounted = false; };
  }, [content?.['@id'], token]);

  return (
    <div className="kyra-ai-chat">
      <ChatPanel
        isOpen={isOpen}
        isDocked={isDocked}
        capabilities={capabilities}
        pageContext={pageContext}
        translationStatus={translationStatus}
        onRefetchTranslationStatus={refetchTranslationStatus}
        onActionsApplied={(result) => {
          if (result?.reload) {
            window.location.reload();
          }
        }}
        onClose={() => { setIsOpen(false); setIsDocked(false); }}
        onToggleDock={() => setIsDocked((v) => !v)}
        uiLanguage={uiLanguage}
      />
      {!isOpen && (
        <LauncherButton
          onClick={() => setIsOpen((value) => !value)}
          isOpen={isOpen}
          badgeCount={translationStatus?.outdated_count || 0}
        />
      )}
    </div>
  );
};

export default ChatWidgetProvider;
