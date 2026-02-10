import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import ChatPanel from './ChatPanel';
import LauncherButton from './LauncherButton';
import {
  getAiCapabilities,
  getAiChatTranslations,
  getTranslationStatus,
  postAiChat,
  postAiChatStream,
  postAiChatUpload,
} from './api';
import { extractPageContent } from './extractPageContent';
import {
  loadLocalConversations,
  removeLocalConversation,
  saveLocalConversation,
  loadPanelMode,
  savePanelMode,
  loadCustomIcon,
  saveCustomIcon,
  loadCustomIconColor,
  saveCustomIconColor,
  loadAccentColor,
  saveAccentColor,
  loadChatName,
  saveChatName,
  clearAllConversations,
} from './storage';
import type {
  ChatCapabilities,
  ChatConversation,
  ChatMessage,
  ChatRequestPayload,
  ChatResponsePayload,
  ChatContextPayload,
  ChatQuickAction,
  TranslationStatus,
} from './types';

const DEFAULT_CAPABILITIES: ChatCapabilities = {
  is_anonymous: true,
  can_edit: false,
  features: [],
};

const generateId = () =>
  `chat_${Math.random().toString(36).slice(2, 10)}`;

const buildTitle = (content: string, lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  const defaultTitle = isDe ? 'Neuer Chat' : 'New chat';
  const trimmed = content.trim();
  if (!trimmed) return defaultTitle;

  // Prefer the first sentence or first line
  const firstSegment = trimmed.split(/[\n\r.!?]/)[0] || trimmed;
  const tokens = firstSegment
    .replace(/["“”‚‘’]+/g, '')
    .trim()
    .split(/\s+/);

  const stopwords = isDe
    ? ['bitte', 'aktualisiere', 'ändere', 'ersetze', 'setze', 'mache', 'füge', 'entferne', 'schreibe', 'erstelle', 'übersetze', 'zusammenfassen', 'fasse']
    : ['please', 'update', 'change', 'set', 'make', 'add', 'remove', 'write', 'create', 'replace', 'translate', 'summarize', 'summarise'];

  const filtered = tokens.filter(
    (tok) => tok && !stopwords.includes(tok.toLowerCase()),
  );

  const selected = (filtered.length ? filtered : tokens).slice(0, 6).join(' ');
  const title = selected.trim().replace(/\s+/g, ' ');
  if (!title) return defaultTitle;
  const capped = title.charAt(0).toUpperCase() + title.slice(1);
  if (capped.length <= 60) return capped;
  return `${capped.slice(0, 57)}...`;
};

const getQuickActions = (lang?: string): ChatQuickAction[] => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return [
      { label: 'Seite zusammenfassen', mode: 'summarize' },
      { label: 'Verwandte Inhalte finden', mode: 'related' },
      { label: 'Website durchsuchen', mode: 'search' },
    ];
  }
  return [
    { label: 'Summarize this page', mode: 'summarize' },
    { label: 'Find related content', mode: 'related' },
    { label: 'Search the site', mode: 'search' },
  ];
};

const ChatWidgetProvider: React.FC = () => {
  const userSession = useSelector((state: any) => state.userSession);
  const token = userSession?.token;
  const content = useSelector((state: any) => state.content?.data);

  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(
    () => loadPanelMode() === 'docked',
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'actions'>('chat');
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customIcon, setCustomIcon] = useState<string | null>(() => loadCustomIcon());
  const [customIconColor, setCustomIconColor] = useState<string>(() => loadCustomIconColor());
  const [accentColor, setAccentColor] = useState<string | null>(() => loadAccentColor());
  const [chatName, setChatName] = useState<string | null>(() => loadChatName());
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<ChatCapabilities>(DEFAULT_CAPABILITIES);
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [languageNotice, setLanguageNotice] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ file_id: string; name?: string; text?: string }>
  >([]);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);
  const conversationRef = useRef<ChatConversation | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const fallbackLanguage = useMemo(() => {
    if (typeof document !== 'undefined') {
      const docLang = document.documentElement?.lang;
      if (docLang) return docLang;
    }
    if (typeof navigator !== 'undefined') {
      return (
        navigator.language ||
        // eslint-disable-next-line @typescript-eslint/dot-notation
        (navigator as any)['userLanguage'] ||
        'en'
      );
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

  const pageContentText = useMemo(
    () => extractPageContent(content),
    [content],
  );

  const userKey = useMemo(() => {
    if (token) {
      const username =
        userSession?.login?.username ||
        userSession?.user?.id ||
        userSession?.user?.username;
      if (username) return `user:${username}`;
      return `token:${String(token).slice(0, 8)}`;
    }
    return 'anon';
  }, [token, userSession]);

  const pageContext = useMemo<ChatContextPayload | undefined>(() => {
    if (!pageReference) return undefined;
    return {
      mode: 'page',
      page: pageReference.page,
    };
  }, [pageReference]);

  const quickActions = useMemo(
    () => getQuickActions(preferredLanguage),
    [preferredLanguage],
  );

  const defaultChatTitle = useMemo(() => {
    const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
    return isDe ? 'Neuer Chat' : 'New chat';
  }, [preferredLanguage]);

  useEffect(() => {
    const stored = loadLocalConversations(userKey);
    setHistory(stored);
    if (stored.length > 0) {
      setConversation(stored[0]);
    }
  }, [userKey]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    if (!preferredLanguage) {
      setPreferredLanguage(fallbackLanguage);
    }
  }, [fallbackLanguage, preferredLanguage]);

  useEffect(() => {
    let isMounted = true;
    const loadTranslations = async () => {
      try {
        const translations = await getAiChatTranslations(token);
        if (!isMounted) return;
        if (translations.language) {
          setPreferredLanguage(translations.language);
        }
        if (translations.notice) {
          setLanguageNotice(translations.notice);
        }
      } catch (_error) {
        // Ignore translation errors.
      }
    };
    loadTranslations();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!capabilities.can_edit && activeTab === 'actions') {
      setActiveTab('chat');
    }
  }, [capabilities.can_edit, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, pageReference?.page?.uid, pageReference?.page?.url, token]);

  const refetchTranslationStatus = async () => {
    const pageUrl = content?.['@id'];
    if (!pageUrl || !token) {
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
    if (!pageUrl || !token) {
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

  const persistConversation = (nextConversation: ChatConversation) => {
    const updatedHistory = saveLocalConversation(nextConversation, userKey);
    setHistory(updatedHistory);
  };

  const createConversation = (firstMessage?: ChatMessage) => {
    const now = new Date().toISOString();
    const newConversation: ChatConversation = {
      id: generateId(),
      title: firstMessage
        ? buildTitle(firstMessage.content, preferredLanguage)
        : defaultChatTitle,
      messages: firstMessage ? [firstMessage] : [],
      updatedAt: now,
    };
    persistConversation(newConversation);
    return newConversation;
  };

  const deleteConversation = (conversationId: string) => {
    const updatedHistory = removeLocalConversation(conversationId, userKey);
    setHistory(updatedHistory);
    if (conversation?.id === conversationId) {
      if (updatedHistory.length > 0) {
        setConversation(updatedHistory[0]);
      } else {
        const next = createConversation();
        setConversation(next);
      }
    }
  };

  const persistUpdatedConversation = (updated: ChatConversation) => {
    const updatedHistory = saveLocalConversation(updated, userKey);
    setHistory(updatedHistory);
    if (conversation?.id === updated.id) {
      setConversation(updated);
    }
  };

  const togglePinConversation = (conversationId: string) => {
    const target = history.find((item) => item.id === conversationId);
    if (!target) return;
    const updated = {
      ...target,
      pinned: !Boolean(target.pinned),
      updatedAt: new Date().toISOString(),
    };
    persistUpdatedConversation(updated);
  };

  const toggleArchiveConversation = (conversationId: string) => {
    const target = history.find((item) => item.id === conversationId);
    if (!target) return;
    const updated = {
      ...target,
      archived: !Boolean(target.archived),
      updatedAt: new Date().toISOString(),
    };
    persistUpdatedConversation(updated);
  };

  const updateConversationState = (
    nextConversation: ChatConversation,
    persist = false,
    previousId?: string,
  ) => {
    conversationRef.current = nextConversation;
    setConversation(nextConversation);
    if (!persist) return;
    const updatedHistory = saveLocalConversation(nextConversation, userKey);
    setHistory(updatedHistory);
    if (previousId && previousId !== nextConversation.id) {
      const cleaned = removeLocalConversation(previousId, userKey);
      setHistory(cleaned);
    }
  };

  const applyAssistantUpdate = (
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage,
    persist = false,
    previousId?: string,
  ) => {
    const current = conversationRef.current;
    if (!current) return;
    const messages = current.messages.map((message) =>
      message.id === assistantId ? updater(message) : message,
    );
    const nextConversation = {
      ...current,
      messages,
      updatedAt: new Date().toISOString(),
    };
    updateConversationState(nextConversation, persist, previousId);
  };

  const finalizeAssistant = (
    assistantId: string,
    data: {
      content?: string;
      citations?: ChatMessage['citations'];
      status?: ChatMessage['status'];
      conversationId?: string;
    },
    previousId?: string,
  ) => {
    const current = conversationRef.current;
    if (!current) return;
    const messages = current.messages.map((message) => {
      if (message.id !== assistantId) return message;
      return {
        ...message,
        content: data.content ?? message.content,
        citations: data.citations ?? message.citations,
        status: data.status ?? 'done',
      };
    });
    const nextConversation = {
      ...current,
      id: data.conversationId || current.id,
      messages,
      updatedAt: new Date().toISOString(),
    };
    updateConversationState(nextConversation, true, previousId);
  };

  const handleSend = async (
    contentText: string,
    contextOverrides?: Partial<ChatContextPayload>,
  ) => {
    if (isSending) return;
    setError(null);
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: contentText,
      createdAt: now,
    };

    let workingConversation = conversationRef.current || conversation;
    if (!workingConversation) {
      workingConversation = createConversation();
    }

    const isDefaultTitle =
      !workingConversation.title ||
      workingConversation.title.toLowerCase() === 'new chat' ||
      workingConversation.title.toLowerCase() === 'neuer chat' ||
      workingConversation.title === defaultChatTitle;

    workingConversation = {
      ...workingConversation,
      title: isDefaultTitle
        ? buildTitle(contentText, preferredLanguage)
        : workingConversation.title,
      messages: [...workingConversation.messages, userMessage],
      updatedAt: now,
    };
    updateConversationState(workingConversation, true);

    const assistantId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
      citations: [],
    };

    const conversationWithAssistant = {
      ...workingConversation,
      messages: [...workingConversation.messages, assistantMessage],
      updatedAt: now,
    };
    updateConversationState(conversationWithAssistant, false);

    const contextPayload: ChatContextPayload = {
      mode: contextOverrides?.mode || 'page',
      page: pageReference?.page,
      page_content: pageContentText || undefined,
      query: contextOverrides?.query,
      selection_text: contextOverrides?.selection_text,
    };

    const resolvedLanguage = preferredLanguage || fallbackLanguage;
    const paramsPayload: ChatRequestPayload['params'] = {};
    if (resolvedLanguage) {
      paramsPayload.language = resolvedLanguage;
    }

    const payload: ChatRequestPayload = {
      conversation_id: workingConversation.id,
      messages: workingConversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      context: {
        ...contextPayload,
        uploads: attachments.length ? attachments : undefined,
      },
      params: Object.keys(paramsPayload).length ? paramsPayload : undefined,
    };

    const canStream = capabilities.features?.includes('streaming');

    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
    }

    const previousId = workingConversation.id;
    const controller = new AbortController();
    streamControllerRef.current = controller;
    setIsSending(true);

    const handleNonStreaming = async (response: ChatResponsePayload) => {
      const assistantContent =
        response.message?.content ||
        'No response was returned. Please try again.';
      finalizeAssistant(
        assistantId,
        {
          content: assistantContent,
          citations: response.citations || [],
          status: 'done',
          conversationId: response.conversation_id,
        },
        previousId,
      );
      if (response.capabilities) {
        setCapabilities(response.capabilities);
      }
    };

    try {
      if (!canStream) {
        const response = await postAiChat(payload, token);
        await handleNonStreaming(response);
        return;
      }

      const streamResult = await postAiChatStream(
        payload,
        {
          onToken: (delta) => {
            applyAssistantUpdate(assistantId, (message) => ({
              ...message,
              content: `${message.content || ''}${delta}`,
              status: 'streaming',
            }));
          },
          onCitations: (citations) => {
            applyAssistantUpdate(assistantId, (message) => ({
              ...message,
              citations,
            }));
          },
          onDone: (data) => {
            finalizeAssistant(
              assistantId,
              {
                content: data?.message?.content,
                citations: data?.citations,
                status: 'done',
                conversationId: data?.conversation_id,
              },
              previousId,
            );
            if (data?.capabilities) {
              setCapabilities(data.capabilities);
            }
          },
          onError: (message) => {
            setError(message || 'Unable to reach Kyra AI.');
            finalizeAssistant(
              assistantId,
              {
                content: message || 'Unable to reach Kyra AI.',
                status: 'error',
              },
              previousId,
            );
          },
        },
        controller.signal,
        token,
      );

      if (streamResult.fallback) {
        if (streamResult.data) {
          await handleNonStreaming(streamResult.data);
        } else {
          const response = await postAiChat(payload, token);
          await handleNonStreaming(response);
        }
      }
    } catch (requestError: any) {
      if (requestError?.name === 'AbortError') {
        setIsSending(false);
        return;
      }
      try {
        const response = await postAiChat(payload, token);
        await handleNonStreaming(response);
      } catch (_fallbackError) {
        setError('Unable to reach Kyra AI. Please try again.');
        finalizeAssistant(
          assistantId,
          {
            content: 'Unable to reach Kyra AI. Please try again.',
            status: 'error',
          },
          previousId,
        );
      }
    } finally {
      streamControllerRef.current = null;
      setIsSending(false);
      setAttachments([]);
    }
  };

  const pageTitle = content?.Title || content?.title || '';

  const handleQuickAction = (action: ChatQuickAction) => {
    const query =
      action.mode === 'summarize' ? undefined : pageTitle || action.label;

    handleSend(action.label, {
      mode: action.mode,
      query,
    });
  };

  const handleRegenerate = (assistantMessage: ChatMessage) => {
    if (isSending) return;
    const current = conversationRef.current;
    if (!current) return;
    const index = current.messages.findIndex((m) => m.id === assistantMessage.id);
    if (index === -1) return;
    const lastUser = [...current.messages.slice(0, index)]
      .reverse()
      .find((m) => m.role === 'user' && m.content);
    if (!lastUser?.content) return;
    handleSend(lastUser.content);
  };

  const handleSelectConversation = (conversationId: string) => {
    const selected = history.find((item) => item.id === conversationId) || null;
    setConversation(selected);
    setShowHistory(false);
  };

  const handleNewConversation = () => {
    const fresh = createConversation();
    setConversation(fresh);
        setShowHistory(false);
        setAttachments([]);
      };

  const renameConversation = (conversationId: string) => {
    const target = history.find((item) => item.id === conversationId);
    if (!target) return;
    const currentTitle = target.title || 'Untitled';
    const newTitle = window.prompt('Rename conversation', currentTitle);
    if (newTitle === null) return;
    const nextTitle = newTitle.trim() || 'Untitled';
    if (nextTitle === currentTitle) return;
    const updated = {
      ...target,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    };
    const updatedHistory = saveLocalConversation(updated);
    setHistory(updatedHistory);
    if (conversation?.id === conversationId) {
      setConversation(updated);
    }
  };

      const handleUpload = async (file: File) => {
    try {
      const uploaded = await postAiChatUpload(file, token);
      setAttachments((prev) => [
        ...prev,
        {
          file_id: uploaded.file_id,
          name: uploaded.name,
          text: uploaded.text,
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    }
  };

  const handleRemoveAttachment = (file_id: string) => {
    setAttachments((prev) => prev.filter((item) => item.file_id !== file_id));
  };

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

  const handleClearHistory = () => {
    clearAllConversations(userKey);
    setHistory([]);
    const fresh = createConversation();
    setConversation(fresh);
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
        activeTab={activeTab}
        isSending={isSending}
        error={error}
        conversation={conversation}
        capabilities={capabilities}
        showHistory={showHistory}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((value) => !value)}
        customIcon={customIcon}
        customIconColor={customIconColor}
        accentColor={accentColor}
        chatName={chatName}
        onSaveSettings={handleSaveSettings}
        onClearHistory={handleClearHistory}
        history={history}
        pageContext={pageContext}
        quickActions={quickActions}
        onQuickAction={handleQuickAction}
        translationStatus={translationStatus}
        onRefetchTranslationStatus={refetchTranslationStatus}
        onActionsApplied={(result) => {
          if (result?.reload) {
            window.location.reload();
          }
        }}
        onClose={() => setIsOpen(false)}
        onToggleDock={() =>
          setIsDocked((value) => {
            const next = !value;
            savePanelMode(next ? 'docked' : 'floating');
            return next;
          })
        }
        onToggleHistory={() => setShowHistory((value) => !value)}
        onTabChange={setActiveTab}
        onSend={handleSend}
        onRegenerate={handleRegenerate}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onPinConversation={togglePinConversation}
        onArchiveConversation={toggleArchiveConversation}
        uiLanguage={preferredLanguage}
        languageNotice={languageNotice}
        attachments={attachments}
        onUploadFile={handleUpload}
        onRemoveAttachment={handleRemoveAttachment}
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
