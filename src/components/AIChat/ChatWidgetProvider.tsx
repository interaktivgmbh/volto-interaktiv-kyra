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
  postAiActionsPlan,
  postAiActionsApply,
} from './api';
import { extractPageContent } from './extractPageContent';
import {
  loadLocalConversations,
  removeLocalConversation,
  saveLocalConversation,
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
  ChatMessageAction,
  ChatRequestPayload,
  ChatResponsePayload,
  ChatContextPayload,
  TranslationStatus,
} from './types';

const DEFAULT_CAPABILITIES: ChatCapabilities = {
  is_anonymous: true,
  can_edit: false,
  features: [],
};

const generateId = () =>
  `chat_${Math.random().toString(36).slice(2, 10)}`;

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
};

const ALL_LANGUAGES = Object.keys(LANGUAGE_NAMES);

const getTranslationLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      scopeTitle: 'Was soll \u00fcbersetzt werden?',
      scopeSingle: 'Nur diese Seite',
      scopeSubtree: 'Diese Seite + Unterseiten',
      languageTitle: 'In welche Sprache \u00fcbersetzen?',
      overwriteTitle: 'Bestehende \u00dcbersetzung',
      overwriteMessage: (name: string) =>
        `Es gibt bereits eine \u00dcbersetzung auf ${name}. \u00dcberschreiben?`,
      overwriteYes: 'Ja, \u00fcberschreiben',
      overwriteNo: 'Nein, abbrechen',
      running: '\u00dcbersetzung l\u00e4uft\u2026',
      successSingle: (name: string) =>
        `\u00dcbersetzung nach ${name} erfolgreich abgeschlossen.`,
      successSubtree: (name: string) =>
        `\u00dcbersetzung (inkl. Unterseiten) nach ${name} erfolgreich abgeschlossen.`,
      error: '\u00dcbersetzung fehlgeschlagen. Bitte erneut versuchen.',
      cancelled: '\u00dcbersetzung abgebrochen.',
      cancel: 'Abbrechen',
      syncNotice: (count: number) =>
        `${count} \u00dcbersetzung${count > 1 ? 'en sind' : ' ist'} veraltet und sollte${count > 1 ? 'n' : ''} aktualisiert werden.`,
      syncButton: (name: string) => `${name} synchronisieren`,
      syncRunning: (name: string) => `Synchronisiere ${name}\u2026`,
      syncSuccess: (name: string) => `${name} wurde erfolgreich synchronisiert.`,
      syncTitle: 'Welche \u00dcbersetzung soll synchronisiert werden?',
    };
  }
  return {
    scopeTitle: 'What should be translated?',
    scopeSingle: 'This page only',
    scopeSubtree: 'This page + subpages',
    languageTitle: 'Translate to which language?',
    overwriteTitle: 'Existing translation',
    overwriteMessage: (name: string) =>
      `A translation to ${name} already exists. Overwrite it?`,
    overwriteYes: 'Yes, overwrite',
    overwriteNo: 'No, cancel',
    running: 'Translating\u2026',
    successSingle: (name: string) =>
      `Translation to ${name} completed successfully.`,
    successSubtree: (name: string) =>
      `Translation (including subpages) to ${name} completed successfully.`,
    error: 'Translation failed. Please try again.',
    cancelled: 'Translation cancelled.',
    cancel: 'Cancel',
    syncNotice: (count: number) =>
      `${count} translation${count > 1 ? 's are' : ' is'} outdated and should be updated.`,
    syncButton: (name: string) => `Sync ${name}`,
    syncRunning: (name: string) => `Syncing ${name}\u2026`,
    syncSuccess: (name: string) => `${name} has been synced successfully.`,
    syncTitle: 'Which translation should be synced?',
  };
};

const buildTitle = (content: string, lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  const defaultTitle = isDe ? 'Neuer Chat' : 'New chat';
  const trimmed = content.trim();
  if (!trimmed) return defaultTitle;

  const firstSegment = trimmed.split(/[\n\r.!?]/)[0] || trimmed;
  const tokens = firstSegment
    .replace(/["\u201C\u201D\u201A\u2018\u2019]+/g, '')
    .trim()
    .split(/\s+/);

  const stopwords = isDe
    ? ['bitte', 'aktualisiere', '\u00e4ndere', 'ersetze', 'setze', 'mache', 'f\u00fcge', 'entferne', 'schreibe', 'erstelle', '\u00fcbersetze', 'zusammenfassen', 'fasse']
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

const ChatWidgetProvider: React.FC = () => {
  const userSession = useSelector((state: any) => state.userSession);
  const token = userSession?.token;
  const content = useSelector((state: any) => state.content?.data);

  const [isOpen, setIsOpen] = useState(false);
  const isDocked = true;
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
  const [preferredLanguage, setPreferredLanguage] = useState('');
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
    const cls = 'has-ai-panel-docked';
    if (isOpen && isDocked) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
    return () => {
      document.body.classList.remove(cls);
    };
  }, [isOpen, isDocked]);

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
      context: contextPayload,
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
            setError(message || 'Unable to reach AI.');
            finalizeAssistant(
              assistantId,
              {
                content: message || 'Unable to reach AI.',
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
        setError('Unable to reach AI. Please try again.');
        finalizeAssistant(
          assistantId,
          {
            content: 'Unable to reach AI. Please try again.',
            status: 'error',
          },
          previousId,
        );
      }
    } finally {
      streamControllerRef.current = null;
      setIsSending(false);
    }
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
    const updatedHistory = saveLocalConversation(updated, userKey);
    setHistory(updatedHistory);
    if (conversation?.id === conversationId) {
      setConversation(updated);
    }
  };

  const refetchTranslationStatus = async () => {
    const pageUrl = content?.['@id'];
    if (!pageUrl || !token) return;
    try {
      const status = await getTranslationStatus(pageUrl, token);
      setTranslationStatus(status);
    } catch (_error) {
      // Ignore refetch errors.
    }
  };

  const handleTranslationComplete = (result: { reload?: boolean }) => {
    refetchTranslationStatus();
    if (result?.reload) {
      window.location.reload();
    }
  };

  const buildSyncActions = () => {
    const t = getTranslationLabels(preferredLanguage);
    const outdated = (translationStatus?.translations || []).filter(
      (item) => item.is_outdated,
    );
    if (outdated.length === 0) return null;

    const actions: ChatMessageAction[] = outdated.map((item) => ({
      label: t.syncButton(LANGUAGE_NAMES[item.language] || item.language),
      value: `sync:${item.language}`,
    }));
    actions.push({ label: t.cancel, value: 'cancel:cancel', variant: 'ghost' });
    return { actions, count: outdated.length };
  };

  const startSyncWizard = () => {
    const t = getTranslationLabels(preferredLanguage);
    const syncData = buildSyncActions();
    if (!syncData) return;

    const now = new Date().toISOString();
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: t.syncTitle,
      createdAt: now,
      status: 'done',
      actions: syncData.actions,
      wizardMeta: { step: 'sync' },
    };

    let workingConversation = conversationRef.current || conversation;
    if (!workingConversation) {
      workingConversation = createConversation();
    }

    const nextConversation = {
      ...workingConversation,
      messages: [...workingConversation.messages, assistantMessage],
      updatedAt: now,
    };
    updateConversationState(nextConversation, true);
  };

  const startTranslationWizard = () => {
    const t = getTranslationLabels(preferredLanguage);
    const now = new Date().toISOString();

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: t.scopeTitle,
      createdAt: now,
      status: 'done',
      actions: [
        { label: t.scopeSingle, value: 'scope:single', icon: 'page' },
        { label: t.scopeSubtree, value: 'scope:subtree', icon: 'folder' },
        { label: t.cancel, value: 'cancel:cancel', variant: 'ghost' },
      ],
      wizardMeta: { step: 'scope' },
    };

    let workingConversation = conversationRef.current || conversation;
    if (!workingConversation) {
      workingConversation = createConversation();
    }

    const nextConversation = {
      ...workingConversation,
      messages: [...workingConversation.messages, assistantMessage],
      updatedAt: now,
    };
    updateConversationState(nextConversation, true);
  };

  const executeTranslationViaMessages = async (
    targetLang: string,
    mode: 'single' | 'subtree',
    overwrite: boolean,
    customLabels?: { running: string; success: string },
    incremental?: boolean,
  ) => {
    const t = getTranslationLabels(preferredLanguage);
    const now = new Date().toISOString();

    const runningId = generateId();
    const runningMessage: ChatMessage = {
      id: runningId,
      role: 'assistant',
      content: customLabels?.running || t.running,
      createdAt: now,
      status: 'streaming',
    };

    const currentConv = conversationRef.current;
    if (!currentConv) return;

    const withRunning = {
      ...currentConv,
      messages: [...currentConv.messages, runningMessage],
      updatedAt: now,
    };
    updateConversationState(withRunning, false);

    const translation = {
      target_language: targetLang,
      mode,
      overwrite,
      ...(incremental ? { incremental: true } : {}),
    };

    const pagePayload = pageReference?.page || undefined;

    try {
      const planResponse = await postAiActionsPlan({
        goal: 'Translate content',
        page: pagePayload,
        constraints: { allowlist: ['translate_content'] },
        translation,
      });

      const result = await postAiActionsApply({
        plan_id: planResponse.plan_id,
        actions: planResponse.actions,
        page: pagePayload,
        translation,
      });

      const langName = LANGUAGE_NAMES[targetLang] || targetLang;
      const successText = customLabels?.success
        || (mode === 'subtree'
          ? t.successSubtree(langName)
          : t.successSingle(langName));

      finalizeAssistant(runningId, {
        content: successText,
        status: 'done',
      });

      handleTranslationComplete(result || { reload: true });
    } catch (_err) {
      finalizeAssistant(runningId, {
        content: t.error,
        status: 'error',
      });
    }
  };

  const handleWizardAction = async (messageId: string, value: string) => {
    const current = conversationRef.current;
    if (!current) return;

    const t = getTranslationLabels(preferredLanguage);
    const sourceLanguage = translationStatus?.source_language || '';
    const now = new Date().toISOString();

    const clickedMessage = current.messages.find((m) => m.id === messageId);
    if (!clickedMessage) return;

    // Remove actions from clicked message
    const messagesWithoutActions = current.messages.map((m) =>
      m.id === messageId ? { ...m, actions: undefined } : m,
    );

    const [actionType, actionValue] = value.split(':');

    // Determine user-visible label
    let userLabel = actionValue;
    if (actionType === 'scope') {
      userLabel = actionValue === 'single' ? t.scopeSingle : t.scopeSubtree;
    } else if (actionType === 'language') {
      userLabel = LANGUAGE_NAMES[actionValue] || actionValue;
    } else if (actionType === 'overwrite') {
      userLabel = actionValue === 'yes' ? t.overwriteYes : t.overwriteNo;
    } else if (actionType === 'sync') {
      userLabel = t.syncButton(LANGUAGE_NAMES[actionValue] || actionValue);
    } else if (actionType === 'cancel') {
      userLabel = t.cancel;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: userLabel,
      createdAt: now,
    };

    let nextMessages = [...messagesWithoutActions, userMessage];

    if (actionType === 'scope') {
      const mode = actionValue as 'single' | 'subtree';
      const availableLanguages = ALL_LANGUAGES.filter(
        (lang) => lang !== sourceLanguage,
      );

      const languageActions: ChatMessageAction[] = availableLanguages.map(
        (lang) => ({
          label: LANGUAGE_NAMES[lang],
          value: `language:${lang}`,
        }),
      );

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: t.languageTitle,
        createdAt: now,
        status: 'done',
        actions: [
          ...languageActions,
          { label: t.cancel, value: 'cancel:cancel', variant: 'ghost' },
        ],
        wizardMeta: { step: 'language', mode },
      };

      nextMessages = [...nextMessages, assistantMessage];
      const nextConv = { ...current, messages: nextMessages, updatedAt: now };
      updateConversationState(nextConv, true);
    } else if (actionType === 'language') {
      const targetLang = actionValue;

      // Find mode from the wizard message that had the language buttons
      const mode = (clickedMessage?.wizardMeta?.mode || 'single') as
        | 'single'
        | 'subtree';

      const hasExisting = translationStatus?.translations?.some(
        (item) => item.language === targetLang,
      );

      if (hasExisting) {
        const langName = LANGUAGE_NAMES[targetLang] || targetLang;
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `${t.overwriteTitle}\n\n${t.overwriteMessage(langName)}`,
          createdAt: now,
          status: 'done',
          actions: [
            { label: t.overwriteYes, value: 'overwrite:yes', variant: 'primary' },
            { label: t.overwriteNo, value: 'overwrite:no', variant: 'ghost' },
          ],
          wizardMeta: { step: 'overwrite', mode, targetLanguage: targetLang },
        };
        nextMessages = [...nextMessages, assistantMessage];
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
      } else {
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
        await executeTranslationViaMessages(targetLang, mode, false);
      }
    } else if (actionType === 'overwrite') {
      if (actionValue === 'no') {
        const cancelMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t.cancelled,
          createdAt: now,
          status: 'done',
        };
        nextMessages = [...nextMessages, cancelMessage];
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
      } else {
        const targetLang = clickedMessage?.wizardMeta?.targetLanguage || '';
        const mode = (clickedMessage?.wizardMeta?.mode || 'single') as
          | 'single'
          | 'subtree';
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
        await executeTranslationViaMessages(targetLang, mode, true);
      }
    } else if (actionType === 'sync') {
      const langName = LANGUAGE_NAMES[actionValue] || actionValue;
      const nextConv = { ...current, messages: nextMessages, updatedAt: now };
      updateConversationState(nextConv, true);
      await executeTranslationViaMessages(actionValue, 'single', true, {
        running: t.syncRunning(langName),
        success: t.syncSuccess(langName),
      }, true);
    } else if (actionType === 'cancel') {
      const cancelMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: t.cancelled,
        createdAt: now,
        status: 'done',
      };
      nextMessages = [...nextMessages, cancelMessage];
      const nextConv = { ...current, messages: nextMessages, updatedAt: now };
      updateConversationState(nextConv, true);
    }
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
        onClose={() => setIsOpen(false)}
        onToggleHistory={() => setShowHistory((value) => !value)}
        onStartTranslation={startTranslationWizard}
        onStartSync={startSyncWizard}
        onWizardAction={handleWizardAction}
        outdatedCount={translationStatus?.outdated_count || 0}

        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onPinConversation={togglePinConversation}
        onArchiveConversation={toggleArchiveConversation}
        uiLanguage={preferredLanguage}
      />
      {!isOpen && token && (
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
