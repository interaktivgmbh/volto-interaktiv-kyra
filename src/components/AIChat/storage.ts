import type { ChatConversation } from './types';

const STORAGE_KEY = 'kyra.aiChat.conversations.v1';
const PANEL_MODE_KEY = 'kyra.aiChat.panelMode.v1';

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

export const loadLocalConversations = (): ChatConversation[] => {
  if (!canUseStorage()) return [];
  const data = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(data)) return [];
  return sortConversations(data.filter(Boolean));
};

export const saveLocalConversation = (
  conversation: ChatConversation,
): ChatConversation[] => {
  if (!canUseStorage()) return [];
  const existing = loadLocalConversations();
  const updated = [
    conversation,
    ...existing.filter((item) => item.id !== conversation.id),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return sortConversations(updated);
};

export const removeLocalConversation = (conversationId: string) => {
  if (!canUseStorage()) return [];
  const existing = loadLocalConversations();
  const updated = existing.filter((item) => item.id !== conversationId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

function sortConversations(conversations: ChatConversation[]) {
  return [...conversations].sort((a, b) => {
    const pinnedA = Boolean(a.pinned);
    const pinnedB = Boolean(b.pinned);
    if (pinnedA !== pinnedB) {
      return pinnedB ? 1 : -1;
    }
    if (a.updatedAt === b.updatedAt) return 0;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

export type AiChatPanelMode = 'docked' | 'floating';

export const loadPanelMode = (): AiChatPanelMode => {
  if (!canUseStorage()) return 'floating';
  const value = window.localStorage.getItem(PANEL_MODE_KEY);
  if (value === 'docked' || value === 'floating') return value;
  return 'floating';
};

export const savePanelMode = (mode: AiChatPanelMode) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PANEL_MODE_KEY, mode);
};
