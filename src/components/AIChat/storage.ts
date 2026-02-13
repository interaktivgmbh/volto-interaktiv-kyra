const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const CUSTOM_ICON_KEY = 'kyra.aiChat.customIcon';
const CUSTOM_ICON_COLOR_KEY = 'kyra.aiChat.customIconColor';
const ACCENT_COLOR_KEY = 'kyra.aiChat.accentColor';
const CHAT_NAME_KEY = 'kyra.aiChat.chatName';

export const loadCustomIcon = (): string | null => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(CUSTOM_ICON_KEY) || null;
};

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
