import { useCallback, useRef, useState } from 'react';
import {
  patchAiChatHistory,
  deleteAiChatConversation,
  reportError,
} from '../api';
import {
  saveLocalConversation,
  removeLocalConversation,
} from '../storage';
import { generateId, buildTitle } from '../utils/chatHelpers';
import type { ChatConversation, ChatMessage } from '../types';

/**
 * Persist edit-engine conversation IDs in sessionStorage so they
 * survive page reloads while the backend MemorySaver still holds the thread.
 */
const _convStorageKey = (kind: 'layout' | 'chat', uid: string) =>
  `kyra.editConvId.${kind}.${uid}`;

export const saveEditConvId = (kind: 'layout' | 'chat', uid: string, convId: string | null) => {
  try {
    const key = _convStorageKey(kind, uid);
    if (convId) {
      sessionStorage.setItem(key, convId);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch (_) { /* SSR / private-mode guard */ }
};

export const loadEditConvId = (kind: 'layout' | 'chat', uid: string): string | null => {
  try {
    return sessionStorage.getItem(_convStorageKey(kind, uid)) || null;
  } catch (_) { return null; }
};

interface UseConversationOptions {
  token: string | undefined;
  userKey: string;
  preferredLanguage: string;
  defaultChatTitle: string;
}

export function useConversation({
  token,
  userKey,
  preferredLanguage,
  defaultChatTitle,
}: UseConversationOptions) {
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const conversationRef = useRef<ChatConversation | null>(null);

  // Keep ref in sync
  const setConversationWithRef = useCallback((conv: ChatConversation | null) => {
    conversationRef.current = conv;
    setConversation(conv);
  }, []);

  const persistConversation = useCallback((nextConversation: ChatConversation) => {
    setHistory((prev) => {
      const filtered = prev.filter((c) => c.id !== nextConversation.id);
      return [nextConversation, ...filtered];
    });
    if (token) {
      patchAiChatHistory({ conversation: nextConversation as any }, token).catch(() => {});
    } else {
      saveLocalConversation(nextConversation, userKey);
    }
  }, [token, userKey]);

  const createConversation = useCallback((firstMessage?: ChatMessage) => {
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
  }, [persistConversation, preferredLanguage, defaultChatTitle]);

  const deleteConversation = useCallback((conversationId: string) => {
    setHistory((prev) => {
      const updated = prev.filter((c) => c.id !== conversationId);
      if (conversationRef.current?.id === conversationId) {
        if (updated.length > 0) {
          setConversationWithRef(updated[0]);
        } else {
          const next = createConversation();
          setConversationWithRef(next);
        }
      }
      return updated;
    });
    if (token) {
      deleteAiChatConversation(conversationId, token).catch(() => {});
    } else {
      removeLocalConversation(conversationId, userKey);
    }
  }, [token, userKey, createConversation, setConversationWithRef]);

  const persistUpdatedConversation = useCallback((updated: ChatConversation) => {
    setHistory((prev) => {
      const filtered = prev.filter((c) => c.id !== updated.id);
      return [updated, ...filtered];
    });
    if (conversationRef.current?.id === updated.id) {
      setConversationWithRef(updated);
    }
    if (token) {
      patchAiChatHistory({ conversation: updated as any }, token).catch(() => {});
    } else {
      saveLocalConversation(updated, userKey);
    }
  }, [token, userKey, setConversationWithRef]);

  const togglePinConversation = useCallback((conversationId: string) => {
    setHistory((prev) => {
      const target = prev.find((item) => item.id === conversationId);
      if (!target) return prev;
      const updated = {
        ...target,
        pinned: !Boolean(target.pinned),
        updatedAt: new Date().toISOString(),
      };
      // Persist inline
      if (token) {
        patchAiChatHistory({ conversation: updated as any }, token).catch(() => {});
      } else {
        saveLocalConversation(updated, userKey);
      }
      if (conversationRef.current?.id === conversationId) {
        setConversationWithRef(updated);
      }
      const filtered = prev.filter((c) => c.id !== conversationId);
      return [updated, ...filtered];
    });
  }, [token, userKey, setConversationWithRef]);

  const toggleArchiveConversation = useCallback((conversationId: string) => {
    setHistory((prev) => {
      const target = prev.find((item) => item.id === conversationId);
      if (!target) return prev;
      const updated = {
        ...target,
        archived: !Boolean(target.archived),
        updatedAt: new Date().toISOString(),
      };
      if (token) {
        patchAiChatHistory({ conversation: updated as any }, token).catch(() => {});
      } else {
        saveLocalConversation(updated, userKey);
      }
      if (conversationRef.current?.id === conversationId) {
        setConversationWithRef(updated);
      }
      const filtered = prev.filter((c) => c.id !== conversationId);
      return [updated, ...filtered];
    });
  }, [token, userKey, setConversationWithRef]);

  const updateConversationState = useCallback((
    nextConversation: ChatConversation,
    persist = false,
    previousId?: string,
  ) => {
    conversationRef.current = nextConversation;
    setConversation(nextConversation);
    if (!persist) return;
    setHistory((prev) => {
      const filtered = prev.filter((c) => c.id !== nextConversation.id);
      return [nextConversation, ...filtered];
    });
    if (token) {
      patchAiChatHistory({ conversation: nextConversation as any }, token).catch(() => {});
      if (previousId && previousId !== nextConversation.id) {
        deleteAiChatConversation(previousId, token).catch(() => {});
        setHistory((prev) => prev.filter((c) => c.id !== previousId));
      }
    } else {
      saveLocalConversation(nextConversation, userKey);
      if (previousId && previousId !== nextConversation.id) {
        removeLocalConversation(previousId, userKey);
        setHistory((prev) => prev.filter((c) => c.id !== previousId));
      }
    }
  }, [token, userKey]);

  const applyAssistantUpdate = useCallback((
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
  }, [updateConversationState]);

  const finalizeAssistant = useCallback((
    assistantId: string,
    data: {
      content?: string;
      citations?: ChatMessage['citations'];
      status?: ChatMessage['status'];
      conversationId?: string;
      actions?: ChatMessage['actions'];
      wizardMeta?: ChatMessage['wizardMeta'];
      toolCalls?: ChatMessage['toolCalls'];
      stateSnapshot?: ChatMessage['stateSnapshot'];
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
        ...(data.toolCalls ? { toolCalls: data.toolCalls } : {}),
        ...(data.stateSnapshot ? { stateSnapshot: data.stateSnapshot } : {}),
      };
    });
    const nextConversation = {
      ...current,
      id: data.conversationId || current.id,
      messages,
      updatedAt: new Date().toISOString(),
    };
    updateConversationState(nextConversation, true, previousId);

    if (data.status === 'error' && data.content && token) {
      reportError({
        error_message: data.content,
        error_type: 'AI Assistant Error',
        component: 'ChatWidgetProvider',
        user_action: current.messages
          .filter((m) => m.role === 'user')
          .slice(-1)[0]?.content || '',
      }, token).catch(() => {});
    }
  }, [updateConversationState, token]);

  const renameConversation = useCallback((conversationId: string) => {
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
    setHistory((prev) => {
      const filtered = prev.filter((c) => c.id !== updated.id);
      return [updated, ...filtered];
    });
    if (conversationRef.current?.id === conversationId) {
      setConversationWithRef(updated);
    }
    if (token) {
      patchAiChatHistory({ conversation: updated as any }, token).catch(() => {});
    } else {
      saveLocalConversation(updated, userKey);
    }
  }, [history, token, userKey, setConversationWithRef]);

  return {
    history,
    setHistory,
    conversation,
    setConversation: setConversationWithRef,
    conversationRef,
    persistConversation,
    createConversation,
    deleteConversation,
    persistUpdatedConversation,
    togglePinConversation,
    toggleArchiveConversation,
    updateConversationState,
    applyAssistantUpdate,
    finalizeAssistant,
    renameConversation,
  };
}
