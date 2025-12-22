import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import ChatPanel from './ChatPanel';
import LauncherButton from './LauncherButton';
import { getAiCapabilities, postAiChat, postAiChatStream } from './api';
import {
  loadLocalConversations,
  removeLocalConversation,
  saveLocalConversation,
  loadPanelMode,
  savePanelMode,
} from './storage';
import type {
  ChatCapabilities,
  ChatConversation,
  ChatMessage,
  ChatRequestPayload,
  ChatResponsePayload,
} from './types';

const DEFAULT_CAPABILITIES: ChatCapabilities = {
  is_anonymous: true,
  can_edit: false,
  features: [],
};

const generateId = () =>
  `chat_${Math.random().toString(36).slice(2, 10)}`;

const buildTitle = (content: string) => {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'New chat';
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}...`;
};

const ChatWidgetProvider: React.FC = () => {
  const token = useSelector((state: any) => state.userSession?.token);
  const content = useSelector((state: any) => state.content?.data);

  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(
    () => loadPanelMode() === 'docked',
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'actions'>('chat');
  const [showHistory, setShowHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<ChatCapabilities>(DEFAULT_CAPABILITIES);
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const conversationRef = useRef<ChatConversation | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  const pageContext = useMemo(() => {
    if (!content) return undefined;
    return {
      mode: 'page' as const,
      page: {
        uid: content?.UID,
        url: content?.['@id'],
      },
    };
  }, [content]);

  useEffect(() => {
    const stored = loadLocalConversations();
    setHistory(stored);
    if (stored.length > 0) {
      setConversation(stored[0]);
    }
  }, []);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

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
        const context = pageContext?.page
          ? { uid: pageContext.page.uid, url: pageContext.page.url }
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
  }, [isOpen, pageContext?.page?.uid, pageContext?.page?.url, token]);

  const persistConversation = (nextConversation: ChatConversation) => {
    const updatedHistory = saveLocalConversation(nextConversation);
    setHistory(updatedHistory);
  };

  const createConversation = (firstMessage?: ChatMessage) => {
    const now = new Date().toISOString();
    const newConversation: ChatConversation = {
      id: generateId(),
      title: firstMessage ? buildTitle(firstMessage.content) : 'New chat',
      messages: firstMessage ? [firstMessage] : [],
      updatedAt: now,
    };
    persistConversation(newConversation);
    return newConversation;
  };

  const updateConversationState = (
    nextConversation: ChatConversation,
    persist = false,
    previousId?: string,
  ) => {
    conversationRef.current = nextConversation;
    setConversation(nextConversation);
    if (!persist) return;
    const updatedHistory = saveLocalConversation(nextConversation);
    setHistory(updatedHistory);
    if (previousId && previousId !== nextConversation.id) {
      const cleaned = removeLocalConversation(previousId);
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

  const handleSend = async (contentText: string) => {
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

    workingConversation = {
      ...workingConversation,
      title: workingConversation.title || buildTitle(contentText),
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

    const payload: ChatRequestPayload = {
      conversation_id: workingConversation.id,
      messages: workingConversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      context: pageContext,
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

  return (
    <div className="kyra-ai-chat">
      <ChatPanel
        isOpen={isOpen}
        isDocked={isDocked}
        activeTab={activeTab}
        isSending={isSending}
        error={error}
        conversation={conversation}
        capabilities={capabilities}
        showHistory={showHistory}
        history={history}
        pageContext={pageContext}
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
      />
      {!isOpen && (
        <LauncherButton
          onClick={() => setIsOpen((value) => !value)}
          isOpen={isOpen}
        />
      )}
    </div>
  );
};

export default ChatWidgetProvider;
