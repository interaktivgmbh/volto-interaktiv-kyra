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
  getAiChatHistory,
  putAiChatHistory,
  patchAiChatHistory,
  postAiChatUpload,
  getEditSkills,
} from './api';
import type { ChatCapabilities, ChatConversation, ChatMessage, ChatMessageAction, ChatRequestPayload, ChatContextPayload, ChatResponsePayload, AiChatUploadResponse, TranslationStatus } from './types';
import { extractPageContent } from './extractPageContent';
import {
  loadLocalConversations,
  loadCustomIcon,
  saveCustomIcon,
  loadCustomIconColor,
  saveCustomIconColor,
  loadAccentColor,
  saveAccentColor,
  loadChatName,
  saveChatName,
  loadPreferredLanguage,
  savePreferredLanguage,
  clearAllConversations,
} from './storage';
import {
  generateId,
  buildTitle,
  darkenColor,
} from './utils/chatHelpers';
import { useConversation } from './hooks/useConversation';
import { useEditMode } from './hooks/useEditMode';
import { useWizard } from './hooks/useWizard';
import { setFormData } from '@plone/volto/actions/form/form';

const DEFAULT_CAPABILITIES: ChatCapabilities = {
  is_anonymous: true,
  can_edit: false,
  features: [],
};

const ChatWidgetProvider: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const dispatch = useDispatch();
  const userSession = useSelector((state: any) => state.userSession);
  const token = userSession?.token;
  const content = useSelector((state: any) => state.content?.data);
  const formData = useSelector((state: any) => state.form?.global);
  const [isVoltoEditMode, setIsVoltoEditMode] = useState(
    typeof window !== 'undefined' && window.location.pathname.endsWith('/edit'),
  );

  useEffect(() => {
    const check = () => {
      const onEdit = window.location.pathname.endsWith('/edit');
      setIsVoltoEditMode((prev) => (prev !== onEdit ? onEdit : prev));
    };
    check();
    window.addEventListener('popstate', check);
    const interval = setInterval(check, 300);
    return () => {
      window.removeEventListener('popstate', check);
      clearInterval(interval);
    };
  }, []);

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('kyra.chatOpen') === '1';
    }
    return false;
  });
  const isDocked = true;
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customIcon, setCustomIcon] = useState<string | null>(() => loadCustomIcon());
  const [customIconColor, setCustomIconColor] = useState<string>(() => loadCustomIconColor());
  const [accentColor, setAccentColor] = useState<string | null>(() => loadAccentColor());
  const [chatName, setChatName] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<ChatCapabilities>(DEFAULT_CAPABILITIES);
  const [preferredLanguage, setPreferredLanguage] = useState(() => loadPreferredLanguage() || '');
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);
  const [contextMode, setContextMode] = useState<'page' | 'site' | 'selection'>('page');
  const [selectionText, setSelectionText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; id: string; file_id: string; text?: string }[]>([]);
  const [skills, setSkills] = useState<Array<{name: string; description: string}>>([]);
  const [editModeActive, setEditModeActive] = useState(false);
  const editModeActiveRef = useRef(false);
  const [editBackendUrl, setEditBackendUrl] = useState('');
  const contextModeRef = useRef<'page' | 'site' | 'selection'>('page');
  const selectionTextRef = useRef('');
  const manualSiteModeRef = useRef(false);
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

  const {
    history,
    setHistory,
    conversation,
    setConversation,
    conversationRef,
    createConversation,
    deleteConversation,
    persistUpdatedConversation,
    togglePinConversation,
    toggleArchiveConversation,
    updateConversationState,
    applyAssistantUpdate,
    finalizeAssistant,
    renameConversation,
  } = useConversation({
    token,
    userKey,
    preferredLanguage,
    defaultChatTitle,
  });

  const editModeDeps = useMemo(() => ({
    editBackendUrl,
    token,
    content,
    formData,
    dispatch,
    isVoltoEditMode,
    editModeActiveRef,
    preferredLanguage,
    selectionTextRef,
    pageContentText,
    attachments,
    applyAssistantUpdate,
    finalizeAssistant,
    updateConversationState,
    setIsSending,
  }), [
    editBackendUrl, token, content, formData, dispatch, isVoltoEditMode,
    preferredLanguage, pageContentText, attachments,
    applyAssistantUpdate, finalizeAssistant, updateConversationState,
  ]);

  const {
    layoutConversationIdRef,
    chatConversationIdRef,
    sendEditMessage,
    restoreConversationIds,
    clearConversationIds,
  } = useEditMode(editModeDeps);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      const stored = loadLocalConversations(userKey);
      setHistory(stored);
      if (stored.length > 0) {
        setConversation(stored[0]);
      }
      const localName = loadChatName();
      if (localName) setChatName(localName);
      return;
    }
    let cancelled = false;
    const loadFromServer = async () => {
      let serverData: { conversations: ChatConversation[]; chat_name: string | null } | null = null;
      try {
        serverData = await getAiChatHistory(token);
      } catch (_err) {
      }
      if (cancelled) return;

      if (serverData) {
        if (serverData.conversations.length > 0 || serverData.chat_name) {
          setHistory(serverData.conversations);
          if (serverData.conversations.length > 0) {
            setConversation(serverData.conversations[0]);
          }
          if (serverData.chat_name) setChatName(serverData.chat_name);
        } else {
          const migrationKey = `kyra.aiChat.migrated.${userKey}`;
          const alreadyMigrated = window.localStorage?.getItem(migrationKey);
          if (!alreadyMigrated) {
            const localConvs = loadLocalConversations(userKey);
            const localName = loadChatName();
            if (localConvs.length > 0 || localName) {
              try {
                await putAiChatHistory({ conversations: localConvs, chat_name: localName }, token);
                setHistory(localConvs);
                if (localConvs.length > 0) setConversation(localConvs[0]);
                if (localName) setChatName(localName);
              } catch (_migrationErr) {
                // Migration failed — don't block
              }
            }
            window.localStorage?.setItem(migrationKey, '1');
          }
        }
      }
    };
    loadFromServer();
    return () => { cancelled = true; };
  }, [userKey, token, setHistory, setConversation]);

  useEffect(() => {
    try { sessionStorage.setItem('kyra.chatOpen', isOpen ? '1' : '0'); } catch (_) {}
  }, [isOpen]);

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
        if (translations.language && !loadPreferredLanguage()) {
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
            try {
              const skillsList = await getEditSkills(token);
              if (isMounted) {
                setSkills(skillsList.map(s => ({ name: s.name, description: s.description })));
              }
            } catch (_err) {}
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

  // Sync edit mode with Volto's /edit route
  const prevEditModeRef = useRef(isVoltoEditMode);
  useEffect(() => {
    updateEditMode(isVoltoEditMode);
    if (prevEditModeRef.current && !isVoltoEditMode) {
      setIsOpen(false);
    }
    prevEditModeRef.current = isVoltoEditMode;
  }, [isVoltoEditMode]);

  // Reset context mode when navigating to a different page
  useEffect(() => {
    updateContextMode('page');
    manualSiteModeRef.current = false;
    updateSelectionText('');
    restoreConversationIds(content?.UID);
  }, [content?.UID, restoreConversationIds]);

  // Listen for text selection on the page (outside chat)
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim() || '';
      if (text.length > 5) {
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
        setTimeout(() => {
          if (contextModeRef.current !== 'selection') return;
          const activeEl = document.activeElement;
          const inChat = activeEl?.closest('.kyra-ai-chat');
          if (inChat) return;
          if (selectionTextRef.current.length > 5) return;
          updateContextMode(manualSiteModeRef.current ? 'site' : 'page');
          updateSelectionText('');
        }, 100);
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
      return isDe ? 'Ausgewählter Text' : 'Selected text';
    }
    return content?.title || content?.Title || null;
  }, [contextMode, content?.title, content?.Title, preferredLanguage]);

  const handleFilesSelected = async (files: File[]) => {
    for (const file of files) {
      const tempId = `upload_${Math.random().toString(36).slice(2, 8)}`;
      setAttachments((prev) => [...prev, { name: file.name, id: tempId, file_id: '' }]);
      try {
        const result: AiChatUploadResponse = await postAiChatUpload(file, token);
        setAttachments((prev) =>
          prev.map((a) => (a.id === tempId ? { ...a, file_id: result.file_id, text: result.text || '' } : a)),
        );
      } catch (_err) {
        setAttachments((prev) => prev.filter((a) => a.id !== tempId));
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
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

    // Edit-engine path (layout or chat conversation via backend)
    if (editBackendUrl) {
      const handled = await sendEditMessage(contentText, workingConversation, now);
      if (handled) return;
    }

    const activeMode = contextOverrides?.mode || contextModeRef.current;
    const activeSelection = contextOverrides?.selection_text || selectionTextRef.current;

    const isSelectionRequest = activeMode === 'selection' && activeSelection.length > 5;
    const originalSelectionText = isSelectionRequest ? activeSelection : '';

    const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');

    let selectionActions: ChatMessageAction[] | undefined;
    let selectionMeta: Record<string, any> | undefined;

    if (promptMeta) {
      selectionActions = [
        { label: isDe ? 'Anwenden' : 'Apply', value: 'prompt:apply', variant: 'primary' },
        { label: isDe ? 'Erneut ausführen' : 'Re-run', value: 'prompt:rerun' },
        { label: isDe ? 'Prompt bearbeiten' : 'Edit prompt', value: 'prompt:edit' },
        { label: isDe ? 'Abbrechen' : 'Dismiss', value: 'prompt:dismiss', variant: 'ghost' },
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
        { label: isDe ? 'Auf Seite anwenden' : 'Apply to page', value: 'apply_selection:apply', variant: 'primary' },
        { label: isDe ? 'Verwerfen' : 'Dismiss', value: 'apply_selection:dismiss', variant: 'ghost' },
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
      ...(attachments.length > 0
        ? { uploads: attachments.filter((a) => a.file_id).map((a) => ({ file_id: a.file_id, name: a.name })) }
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
    setAttachments([]);

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
    clearConversationIds(content?.UID);
  };

  const {
    handleWizardAction,
    startSyncWizard,
    startTranslationWizard,
  } = useWizard({
    token,
    content,
    preferredLanguage,
    translationStatus,
    setTranslationStatus,
    pageReference,
    dispatch,
    conversationRef,
    conversation,
    createConversation,
    updateConversationState,
    finalizeAssistant,
    setEditingMessageId,
    handleSend,
  });

  const handleSaveSettings = (draft: {
    customIcon: string | null;
    iconColor: string;
    accentColor: string | null;
    chatName: string | null;
    language?: string | null;
  }) => {
    saveCustomIcon(draft.customIcon);
    setCustomIcon(draft.customIcon);
    saveCustomIconColor(draft.iconColor);
    setCustomIconColor(draft.iconColor);
    saveAccentColor(draft.accentColor);
    setAccentColor(draft.accentColor);
    setChatName(draft.chatName);
    if (draft.language) {
      savePreferredLanguage(draft.language);
      setPreferredLanguage(draft.language);
    }
    if (token) {
      patchAiChatHistory({ chat_name: draft.chatName }, token).catch(() => {});
    } else {
      saveChatName(draft.chatName);
    }
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

    let origText = '';
    for (let i = userMsgIndex + 1; i < current.messages.length; i++) {
      if (current.messages[i].role === 'assistant' && current.messages[i].wizardMeta?.originalText) {
        origText = current.messages[i].wizardMeta.originalText;
        break;
      }
    }

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
    setHistory([]);
    const fresh = createConversation();
    setConversation(fresh);
    if (token) {
      putAiChatHistory({ conversations: [], chat_name: chatName }, token).catch(() => {});
    } else {
      clearAllConversations(userKey);
    }
  };

  const handleRestoreState = (messageUid: string) => {
    if (!formData) return;
    const msg = conversation?.messages.find((m) => m.id === messageUid);
    if (!msg?.stateSnapshot) return;
    const s = msg.stateSnapshot;
    const restored = { ...formData };
    if (s.blocks) restored.blocks = s.blocks;
    if (s.blocks_layout) restored.blocks_layout = s.blocks_layout;
    if (s.title !== undefined) restored.title = s.title;
    if (s.description !== undefined) restored.description = s.description;
    if (s.preview_image !== undefined) restored.preview_image = s.preview_image;
    if (s.subjects !== undefined) restored.subjects = s.subjects;
    dispatch(setFormData(restored));
  };

  const accentStyles = accentColor
    ? {
        '--ai-chat-accent': accentColor,
        '--ai-chat-accent-strong': darkenColor(accentColor, 30),
      } as React.CSSProperties
    : undefined;

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
        onSend={(text: string) => handleSend(text)}
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
        skills={editModeActive ? skills : []}
        onRestoreState={editBackendUrl ? handleRestoreState : undefined}
        editModeActive={editModeActive}
        editBackendUrl={editBackendUrl}
        onEditModeToggle={() => {
          if (!editModeActive && !isVoltoEditMode) {
            const currentPath = window.location.pathname.replace(/\/edit$/, '');
            window.location.href = `${currentPath}/edit`;
          } else if (editModeActive && isVoltoEditMode) {
            const viewPath = window.location.pathname.replace(/\/edit$/, '');
            window.location.href = viewPath;
          } else {
            updateEditMode(!editModeActive);
          }
        }}
        onFilesSelected={handleFilesSelected}
        attachments={attachments}
        onRemoveAttachment={handleRemoveAttachment}
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
