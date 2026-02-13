import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import ChatPanel from './ChatPanel';
import LauncherButton from './LauncherButton';
import { getAiCapabilities, getTranslationStatus } from './api';
import {
  loadCustomIcon,
  saveCustomIcon,
  loadCustomIconColor,
  saveCustomIconColor,
  loadAccentColor,
  saveAccentColor,
  loadChatName,
  saveChatName,
} from './storage';
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
  const [isDocked, setIsDocked] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [capabilities, setCapabilities] =
    useState<ChatCapabilities>(DEFAULT_CAPABILITIES);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);

  const [customIcon, setCustomIcon] = useState<string | null>(() => loadCustomIcon());
  const [customIconColor, setCustomIconColor] = useState<string>(() => loadCustomIconColor());
  const [accentColor, setAccentColor] = useState<string | null>(() => loadAccentColor());
  const [chatName, setChatName] = useState<string | null>(() => loadChatName());

  const uiLanguage = 'de';

  // Dock-Modus: Seiteninhalt einrücken wie Volto Edit-Sidebar
  useEffect(() => {
    if (isOpen && isDocked) {
      document.body.classList.add('has-ai-panel-docked');
    } else {
      document.body.classList.remove('has-ai-panel-docked');
    }
    return () => {
      document.body.classList.remove('has-ai-panel-docked');
    };
  }, [isOpen, isDocked]);

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

  const handleSaveSettings = (draft: {
    customIcon: string | null;
    iconColor: string;
    accentColor: string | null;
    chatName: string | null;
  }) => {
    saveCustomIcon(draft.customIcon);
    setCustomIcon(draft.customIcon);
    saveCustomIconColor(draft.iconColor);
    setCustomIconColor(draft.iconColor);
    saveAccentColor(draft.accentColor);
    setAccentColor(draft.accentColor);
    saveChatName(draft.chatName);
    setChatName(draft.chatName);
  };

  const darkenColor = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
    const b = Math.max(0, (num & 0x0000ff) - amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const accentStyles = accentColor
    ? {
        '--ai-chat-accent': accentColor,
        '--ai-chat-accent-strong': darkenColor(accentColor, 30),
      } as React.CSSProperties
    : undefined;

  return (
    <div className="kyra-ai-chat" style={accentStyles}>
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
        onClose={() => { setIsOpen(false); setShowSettings(false); }}
        onToggleDock={() => setIsDocked((v) => !v)}
        uiLanguage={uiLanguage}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
        customIcon={customIcon}
        customIconColor={customIconColor}
        accentColor={accentColor}
        chatName={chatName}
        onSaveSettings={handleSaveSettings}
      />
      {!isOpen && (
        <LauncherButton
          onClick={() => setIsOpen((value) => !value)}
          isOpen={isOpen}
          customIcon={customIcon}
          customIconColor={customIconColor}
          badgeCount={translationStatus?.outdated_count || 0}
        />
      )}
    </div>
  );
};

export default ChatWidgetProvider;
