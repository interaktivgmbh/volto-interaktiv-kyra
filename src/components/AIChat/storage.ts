import type { ChatConversation } from './types';

const STORAGE_KEY = 'kyra.aiChat.conversations.v1';
const PANEL_MODE_KEY = 'kyra.aiChat.panelMode.v1';

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Returns raw `any` — parsed data is never validated against the ChatConversation shape.
// Corrupt or tampered localStorage will flow straight into React state.
const safeParse = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null; // Silent catch
  }
};

const keyForUser = (userKey?: string | null) =>
  userKey ? `${STORAGE_KEY}.${userKey}` : `${STORAGE_KEY}.anon`;

export const loadLocalConversations = (
  userKey?: string | null,
): ChatConversation[] => {
  if (!canUseStorage()) return [];
  const data = safeParse(window.localStorage.getItem(keyForUser(userKey)));
  if (!Array.isArray(data)) return [];
  return sortConversations(data.filter(Boolean));
};

export const saveLocalConversation = (
  conversation: ChatConversation,
  userKey?: string | null,
): ChatConversation[] => {
  if (!canUseStorage()) return [];
  const existing = loadLocalConversations(userKey); // loadLocalConversations already sorts — the result is re-sorted below. First sort is wasted.
  const updated = [
    conversation,
    ...existing.filter((item) => item.id !== conversation.id),
  ];
  window.localStorage.setItem(keyForUser(userKey), JSON.stringify(updated)); // No try/catch — throws QuotaExceededError when localStorage is full, crashing the widget.
  return sortConversations(updated);
};

export const removeLocalConversation = (
  conversationId: string,
  userKey?: string | null,
) => {
  if (!canUseStorage()) return [];
  const existing = loadLocalConversations(userKey);
  const updated = existing.filter((item) => item.id !== conversationId);
  window.localStorage.setItem(keyForUser(userKey), JSON.stringify(updated)); // Same QuotaExceededError risk as saveLocalConversation.
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
}

// Dead code — AiChatPanelMode, loadPanelMode, savePanelMode are never imported or called anywhere.
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

// Repetitive load/save pairs below (customIcon, iconColor, accentColor, chatName) all follow the same pattern.
const CUSTOM_ICON_KEY = 'kyra.aiChat.customIcon';
const CUSTOM_ICON_COLOR_KEY = 'kyra.aiChat.customIconColor';

export const loadCustomIcon = (): string | null => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(CUSTOM_ICON_KEY) || null;
};

// No size validation — a large image data URL can exhaust the shared localStorage budget (~5 MB).
export const saveCustomIcon = (dataUrl: string | null) => {
  if (!canUseStorage()) return;
  if (dataUrl) {
    window.localStorage.setItem(CUSTOM_ICON_KEY, dataUrl);
  } else {
    window.localStorage.removeItem(CUSTOM_ICON_KEY);
  }
};

export const loadCustomIconColor = (): string => {
  if (!canUseStorage()) return '#ffffff';
  return window.localStorage.getItem(CUSTOM_ICON_COLOR_KEY) || '#ffffff';
};

export const saveCustomIconColor = (color: string) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(CUSTOM_ICON_COLOR_KEY, color);
};

const ACCENT_COLOR_KEY = 'kyra.aiChat.accentColor';
const CHAT_NAME_KEY = 'kyra.aiChat.chatName';

export const loadAccentColor = (): string | null => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACCENT_COLOR_KEY) || null;
};

export const saveAccentColor = (color: string | null) => {
  if (!canUseStorage()) return;
  if (color) {
    window.localStorage.setItem(ACCENT_COLOR_KEY, color);
  } else {
    window.localStorage.removeItem(ACCENT_COLOR_KEY);
  }
};

export const loadChatName = (): string | null => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(CHAT_NAME_KEY) || null;
};

export const saveChatName = (name: string | null) => {
  if (!canUseStorage()) return;
  if (name) {
    window.localStorage.setItem(CHAT_NAME_KEY, name);
  } else {
    window.localStorage.removeItem(CHAT_NAME_KEY);
  }
};

// No conversation limit or eviction policy. All conversations accumulate indefinitely in a single localStorage key.
export const clearAllConversations = (userKey?: string | null) => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(keyForUser(userKey));
};
