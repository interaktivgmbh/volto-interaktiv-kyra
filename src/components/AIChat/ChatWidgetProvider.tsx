import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

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
  computeBlocksWithReplacement,
  prepareBlocksForEditMode,
  postEditModeRequest,
} from './api';
import { updateContent, unlockContent, lockContent } from '@plone/volto/actions';
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
  const [mounted, setMounted] = useState(false);
  const dispatch = useDispatch();
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
  const [contextMode, setContextMode] = useState<'page' | 'site' | 'selection'>('page');
  const [selectionText, setSelectionText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editModeActive, setEditModeActive] = useState(false);
  const editModeActiveRef = useRef(false);
  const [editBackendUrl, setEditBackendUrl] = useState('');
  const contextModeRef = useRef<'page' | 'site' | 'selection'>('page');
  const selectionTextRef = useRef('');
  const manualSiteModeRef = useRef(false);
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
    setMounted(true);
  }, []);

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
          if (response.edit_backend_url) {
            setEditBackendUrl(response.edit_backend_url);
          }
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

  // Helper to update context mode + ref together
  const updateContextMode = (mode: 'page' | 'site' | 'selection') => {
    contextModeRef.current = mode;
    setContextMode(mode);
  };
  const updateSelectionText = (text: string) => {
    selectionTextRef.current = text;
    setSelectionText(text);
  };

  const updateEditMode = (active: boolean) => {
    editModeActiveRef.current = active;
    setEditModeActive(active);
  };

  // Reset context mode when navigating to a different page
  useEffect(() => {
    updateContextMode('page');
    manualSiteModeRef.current = false;
    updateSelectionText('');
    updateEditMode(false);
  }, [content?.UID]);

  // Listen for text selection on the page (outside chat)
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim() || '';
      if (text.length > 5) {
        // Check selection is not inside the chat panel
        const anchor = sel?.anchorNode;
        if (anchor) {
          const el = anchor.nodeType === Node.ELEMENT_NODE
            ? (anchor as Element)
            : anchor.parentElement;
          if (el?.closest('.kyra-ai-chat')) return;
        }
        updateContextMode('selection');
        updateSelectionText(text);
      } else if (contextModeRef.current === 'selection') {
        // Selection cleared — defer check so activeElement has time to update
        // (selectionchange fires before focus transfer completes)
        setTimeout(() => {
          if (contextModeRef.current !== 'selection') return;
          const activeEl = document.activeElement;
          const inChat = activeEl?.closest('.kyra-ai-chat');
          if (inChat) return;
          // Selection cleared by clicking outside chat — revert
          updateContextMode(manualSiteModeRef.current ? 'site' : 'page');
          updateSelectionText('');
        }, 0);
      }
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  const handleDismissContext = () => {
    if (contextMode === 'page') {
      updateContextMode('site');
      manualSiteModeRef.current = true;
    } else if (contextMode === 'selection') {
      updateContextMode('page');
      manualSiteModeRef.current = false;
      updateSelectionText('');
      window.getSelection()?.removeAllRanges();
    }
  };

  const contextLabel = useMemo(() => {
    if (contextMode === 'site') return null;
    if (contextMode === 'selection') {
      const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
      return isDe ? 'Ausgew\u00e4hlter Text' : 'Selected text';
    }
    return content?.title || content?.Title || null;
  }, [contextMode, content?.title, content?.Title, preferredLanguage]);

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
      actions?: ChatMessage['actions'];
      wizardMeta?: ChatMessage['wizardMeta'];
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
        ...(data.actions ? { actions: data.actions } : {}),
        ...(data.wizardMeta ? { wizardMeta: data.wizardMeta } : {}),
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
    promptMeta?: { promptText: string },
    options?: { skipUserMessage?: boolean },
  ) => {
    if (isSending) return;
    setError(null);
    const now = new Date().toISOString();

    let workingConversation = conversationRef.current || conversation;
    if (!workingConversation) {
      workingConversation = createConversation();
    }

    if (!options?.skipUserMessage) {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: contentText,
        createdAt: now,
      };

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
    }
    updateConversationState(workingConversation, true);

    // --- Edit Mode Branch: send blocks to external backend ---
    if (editModeActiveRef.current && editBackendUrl) {
      const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
      const editAssistantId = generateId();
      const editAssistantMsg: ChatMessage = {
        id: editAssistantId,
        role: 'assistant',
        content: isDe ? 'Bereite Seiten-Daten vor\u2026' : 'Preparing page data\u2026',
        createdAt: new Date().toISOString(),
        status: 'streaming',
      };
      const editConv = {
        ...workingConversation,
        messages: [...workingConversation.messages, editAssistantMsg],
        updatedAt: now,
      };
      updateConversationState(editConv, false);
      setIsSending(true);

      try {
        const pageUrl = content?.['@id'] || '';
        const { blocks, blocks_layout } = await prepareBlocksForEditMode(pageUrl, token);

        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Sende an Bearbeiten-Backend\u2026' : 'Sending to edit backend\u2026',
        }));

        const editPayload = {
          message: contentText,
          blocks,
          blocks_layout,
          page: { uid: content?.UID, url: pageUrl },
        };

        let editResponse: { blocks: Record<string, any>; blocks_layout?: { items: string[] } };
        try {
          editResponse = await postEditModeRequest(editBackendUrl, editPayload, token);
        } catch (sendErr: any) {
          // Backend not reachable — download payload as JSON for debugging
          const blob = new Blob([JSON.stringify(editPayload, null, 2)], { type: 'application/json' });
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `edit-payload-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);

          finalizeAssistant(editAssistantId, {
            content: isDe
              ? `Backend nicht erreichbar (${sendErr?.message || 'Netzwerkfehler'}). Der Payload wurde als JSON-Datei heruntergeladen.`
              : `Backend not reachable (${sendErr?.message || 'network error'}). The payload has been downloaded as a JSON file.`,
            status: 'done',
          });
          return;
        }

        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Wende \u00c4nderungen an\u2026' : 'Applying changes\u2026',
        }));

        const contentPath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        try { await (dispatch as any)(unlockContent(contentPath, true)); } catch (_) {}
        await (dispatch as any)(updateContent(contentPath, { blocks: editResponse.blocks }));
        try { await (dispatch as any)(lockContent(contentPath)); } catch (_) {}

        finalizeAssistant(editAssistantId, {
          content: isDe
            ? '\u00c4nderungen erfolgreich angewendet.'
            : 'Changes applied successfully.',
          status: 'done',
        });
        setTimeout(() => window.location.reload(), 800);
      } catch (err: any) {
        finalizeAssistant(editAssistantId, {
          content: isDe
            ? `Fehler: ${err?.message || 'Unbekannter Fehler'}`
            : `Error: ${err?.message || 'Unknown error'}`,
          status: 'error',
        });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Read from refs to survive selection-clear during click events
    // Use contextOverrides.selection_text as fallback (e.g. re-run with stored original)
    const activeMode = contextOverrides?.mode || contextModeRef.current;
    const activeSelection = contextOverrides?.selection_text || selectionTextRef.current;

    // Capture selection info for "apply to page" action
    const isSelectionRequest = activeMode === 'selection' && activeSelection.length > 5;
    const originalSelectionText = isSelectionRequest ? activeSelection : '';

    const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');

    // Prompt Manager prompts get comparison view + 3 action buttons
    let selectionActions: ChatMessageAction[] | undefined;
    let selectionMeta: Record<string, any> | undefined;

    if (promptMeta) {
      selectionActions = [
        {
          label: isDe ? 'Anwenden' : 'Apply',
          value: 'prompt:apply',
          variant: 'primary',
        },
        {
          label: isDe ? 'Erneut ausführen' : 'Re-run',
          value: 'prompt:rerun',
        },
        {
          label: isDe ? 'Prompt bearbeiten' : 'Edit prompt',
          value: 'prompt:edit',
        },
        {
          label: isDe ? 'Abbrechen' : 'Dismiss',
          value: 'prompt:dismiss',
          variant: 'ghost',
        },
      ];
      selectionMeta = {
        step: 'prompt',
        isPromptResult: true,
        originalText: originalSelectionText || undefined,
        promptText: promptMeta.promptText,
        pageUid: content?.UID,
        pageUrl: content?.['@id'],
      };
    } else if (isSelectionRequest) {
      selectionActions = [
        {
          label: isDe ? 'Auf Seite anwenden' : 'Apply to page',
          value: 'apply_selection:apply',
          variant: 'primary',
        },
        {
          label: isDe ? 'Verwerfen' : 'Dismiss',
          value: 'apply_selection:dismiss',
          variant: 'ghost',
        },
      ];
      selectionMeta = {
        step: 'apply_selection',
        originalText: originalSelectionText,
        pageUid: content?.UID,
        pageUrl: content?.['@id'],
      };
    }

    const assistantId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
      citations: [],
      ...(selectionMeta ? { wizardMeta: selectionMeta } : {}),
    };

    const conversationWithAssistant = {
      ...workingConversation,
      messages: [...workingConversation.messages, assistantMessage],
      updatedAt: now,
    };
    updateConversationState(conversationWithAssistant, false);

    const contextPayload: ChatContextPayload = {
      mode: contextOverrides?.mode || 'page',
      ...(activeMode === 'site'
        ? {}
        : activeMode === 'selection'
        ? {
            page: pageReference?.page,
            page_content: activeSelection,
            selection_text: activeSelection,
          }
        : {
            page: pageReference?.page,
            page_content: pageContentText || undefined,
          }),
      query: contextOverrides?.query,
      ...(contextOverrides?.selection_text
        ? { selection_text: contextOverrides.selection_text }
        : {}),
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
          actions: selectionActions,
          wizardMeta: selectionMeta,
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
                actions: selectionActions,
                wizardMeta: selectionMeta,
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
    } else if (actionType === 'apply_selection') {
      const isDe2 = (preferredLanguage || '').toLowerCase().startsWith('de');
      userLabel = actionValue === 'apply'
        ? (isDe2 ? 'Auf Seite anwenden' : 'Apply to page')
        : (isDe2 ? 'Verwerfen' : 'Dismiss');
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
    } else if (actionType === 'prompt') {
      const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
      const meta = clickedMessage.wizardMeta || {};

      if (actionValue === 'apply') {
        // Apply prompt result to page — same as apply_selection:apply
        const originalText = meta.originalText || '';
        const pageUrl = meta.pageUrl || content?.['@id'] || '';
        const assistantContent = clickedMessage.content?.trim() || '';

        if (!originalText || !assistantContent || !pageUrl) {
          const errMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: isDe
              ? 'Konnte den Text nicht auf der Seite ersetzen (fehlende Daten).'
              : 'Could not apply text to page (missing data).',
            createdAt: now,
            status: 'error',
          };
          nextMessages = [...nextMessages, errMsg];
          const nextConv = { ...current, messages: nextMessages, updatedAt: now };
          updateConversationState(nextConv, true);
          return;
        }

        const applyingId = generateId();
        const applyingMsg: ChatMessage = {
          id: applyingId,
          role: 'assistant',
          content: isDe ? 'Wende Änderung auf der Seite an\u2026' : 'Applying changes to page\u2026',
          createdAt: now,
          status: 'streaming',
        };
        nextMessages = [...nextMessages, applyingMsg];
        const tempConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(tempConv, false);

        try {
          const { blocks } = await computeBlocksWithReplacement(
            pageUrl, originalText, assistantContent, token,
          );
          const contentPath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
          try { await (dispatch as any)(unlockContent(contentPath, true)); } catch (_) {}
          await (dispatch as any)(updateContent(contentPath, { blocks }));
          try { await (dispatch as any)(lockContent(contentPath)); } catch (_) {}
          finalizeAssistant(applyingId, {
            content: isDe
              ? 'Text wurde erfolgreich auf der Seite ersetzt.'
              : 'Text has been successfully replaced on the page.',
            status: 'done',
          });
          setTimeout(() => window.location.reload(), 800);
        } catch (err: any) {
          finalizeAssistant(applyingId, {
            content: isDe
              ? `Fehler beim Ersetzen: ${err?.message || 'Unbekannter Fehler'}`
              : `Error replacing text: ${err?.message || 'Unknown error'}`,
            status: 'error',
          });
        }
      } else if (actionValue === 'rerun') {
        // Re-run the same prompt — keep user message, remove old assistant response
        const promptText = meta.promptText || '';
        if (promptText) {
          const msgIndex = current.messages.findIndex((m) => m.id === messageId);
          // Keep everything up to (but not including) this assistant message
          const trimmed = msgIndex > 0
            ? current.messages.slice(0, msgIndex)
            : messagesWithoutActions;
          const nextConv = { ...current, messages: trimmed, updatedAt: now };
          updateConversationState(nextConv, true);
          const origText = meta.originalText || '';
          const ctxOverrides = origText
            ? { mode: 'selection' as const, selection_text: origText }
            : undefined;
          handleSend(promptText, ctxOverrides, { promptText }, { skipUserMessage: true });
        }
      } else if (actionValue === 'edit') {
        // Trigger inline editing on the user message — don't modify messages
        const msgIndex = current.messages.findIndex((m) => m.id === messageId);
        let userMsgId = '';
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (current.messages[i].role === 'user') {
            userMsgId = current.messages[i].id;
            break;
          }
        }
        if (userMsgId) {
          setEditingMessageId(userMsgId);
        }
      } else if (actionValue === 'dismiss') {
        // Dismiss — remove the user message + assistant response entirely
        const msgIndex = current.messages.findIndex((m) => m.id === messageId);
        let removeFrom = msgIndex;
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (current.messages[i].role === 'user') {
            removeFrom = i;
            break;
          }
        }
        const cleaned = current.messages.slice(0, removeFrom);
        const nextConv = { ...current, messages: cleaned, updatedAt: now };
        updateConversationState(nextConv, true);
      }
    } else if (actionType === 'apply_selection') {
      const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');

      if (actionValue === 'dismiss') {
        const nextConv = { ...current, messages: messagesWithoutActions, updatedAt: now };
        updateConversationState(nextConv, true);
        return;
      }

      // "apply" — replace the original text on the page
      const meta = clickedMessage.wizardMeta || {};
      const originalText = meta.originalText || '';
      const pageUrl = meta.pageUrl || content?.['@id'] || '';
      const assistantContent = clickedMessage.content?.trim() || '';

      if (!originalText || !assistantContent || !pageUrl) {
        const errMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: isDe
            ? 'Konnte den Text nicht auf der Seite ersetzen (fehlende Daten).'
            : 'Could not apply text to page (missing data).',
          createdAt: now,
          status: 'error',
        };
        nextMessages = [...nextMessages, errMsg];
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
        return;
      }

      // Show "applying" status
      const applyingId = generateId();
      const applyingMsg: ChatMessage = {
        id: applyingId,
        role: 'assistant',
        content: isDe ? 'Wende Änderung auf der Seite an\u2026' : 'Applying changes to page\u2026',
        createdAt: now,
        status: 'streaming',
      };
      nextMessages = [...nextMessages, applyingMsg];
      const tempConv = { ...current, messages: nextMessages, updatedAt: now };
      updateConversationState(tempConv, false);

      try {
        const { blocks } = await computeBlocksWithReplacement(
          pageUrl,
          originalText,
          assistantContent,
          token,
        );
        const contentPath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        try { await (dispatch as any)(unlockContent(contentPath, true)); } catch (_) {}
        await (dispatch as any)(updateContent(contentPath, { blocks }));
        try { await (dispatch as any)(lockContent(contentPath)); } catch (_) {}
        finalizeAssistant(applyingId, {
          content: isDe
            ? 'Text wurde erfolgreich auf der Seite ersetzt.'
            : 'Text has been successfully replaced on the page.',
          status: 'done',
        });
        setTimeout(() => window.location.reload(), 800);
      } catch (err: any) {
        finalizeAssistant(applyingId, {
          content: isDe
            ? `Fehler beim Ersetzen: ${err?.message || 'Unbekannter Fehler'}`
            : `Error replacing text: ${err?.message || 'Unknown error'}`,
          status: 'error',
        });
      }
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

  const handleApplyPrompt = (promptText: string) => {
    if (!promptText.trim()) return;
    handleSend(promptText, undefined, { promptText: promptText.trim() });
  };

  const handleEditAndResend = (messageId: string, newText: string) => {
    setEditingMessageId(null);
    const current = conversationRef.current;
    if (!current || !newText.trim()) return;

    const userMsgIndex = current.messages.findIndex((m) => m.id === messageId);
    if (userMsgIndex === -1) return;

    // Find the assistant message that follows to get the stored originalText
    let origText = '';
    for (let i = userMsgIndex + 1; i < current.messages.length; i++) {
      if (current.messages[i].role === 'assistant' && current.messages[i].wizardMeta?.originalText) {
        origText = current.messages[i].wizardMeta.originalText;
        break;
      }
    }

    // Update user message content in place, remove the assistant response after it
    const updatedMessages = current.messages
      .slice(0, userMsgIndex + 1)
      .map((m) =>
        m.id === messageId ? { ...m, content: newText.trim() } : m,
      );
    const nextConv = {
      ...current,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };
    updateConversationState(nextConv, true);

    const ctxOverrides = origText
      ? { mode: 'selection' as const, selection_text: origText }
      : undefined;
    handleSend(newText.trim(), ctxOverrides, { promptText: newText.trim() }, { skipUserMessage: true });
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
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

  // Don't render during SSR — avoids settings flash on hydration
  if (!mounted) return null;

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
        onSend={editModeActive ? (text: string) => handleSend(text) : handleApplyPrompt}
        onStartTranslation={startTranslationWizard}
        onStartSync={startSyncWizard}
        onPromptsClick={() => {}}
        onApplyPrompt={handleApplyPrompt}
        onWizardAction={handleWizardAction}
        outdatedCount={translationStatus?.outdated_count || 0}

        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onPinConversation={togglePinConversation}
        onArchiveConversation={toggleArchiveConversation}
        uiLanguage={preferredLanguage}
        contextMode={contextMode}
        contextLabel={contextLabel}
        onDismissContext={handleDismissContext}
        editingMessageId={editingMessageId}
        onEditAndResend={handleEditAndResend}
        onCancelEdit={handleCancelEdit}
        editModeActive={editModeActive}
        editBackendUrl={editBackendUrl}
        onEditModeToggle={() => updateEditMode(!editModeActive)}
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
