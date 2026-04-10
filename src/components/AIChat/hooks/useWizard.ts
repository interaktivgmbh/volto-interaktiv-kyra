import { useCallback } from 'react';
import {
  getTranslationStatus,
  postAiActionsPlan,
  postAiActionsApply,
  computeBlocksWithReplacement,
} from '../api';
import { updateContent, unlockContent, lockContent } from '@plone/volto/actions';
import {
  generateId,
  LANGUAGE_NAMES,
  ALL_LANGUAGES,
  getTranslationLabels,
} from '../utils/chatHelpers';
import type {
  ChatMessage,
  ChatMessageAction,
  ChatConversation,
  TranslationStatus,
} from '../types';

interface UseWizardDeps {
  token: string | undefined;
  content: any;
  preferredLanguage: string;
  translationStatus: TranslationStatus | null;
  setTranslationStatus: (status: TranslationStatus | null) => void;
  pageReference: { page: { uid: string; url: string } } | undefined;
  dispatch: any;
  conversationRef: React.MutableRefObject<ChatConversation | null>;
  conversation: ChatConversation | null;
  createConversation: () => ChatConversation;
  updateConversationState: (conv: ChatConversation, persist: boolean) => void;
  finalizeAssistant: (
    id: string,
    update: {
      content?: string;
      citations?: any[];
      status?: string;
      conversationId?: string;
      actions?: ChatMessageAction[];
      wizardMeta?: Record<string, any>;
    },
    previousId?: string,
  ) => void;
  setEditingMessageId: (id: string | null) => void;
  handleSend: (
    text: string,
    contextOverrides?: any,
    promptMeta?: { promptText: string },
    options?: { skipUserMessage?: boolean },
  ) => Promise<void>;
}

export function useWizard(deps: UseWizardDeps) {
  const {
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
  } = deps;

  const refetchTranslationStatus = useCallback(async () => {
    const pageUrl = content?.['@id'];
    if (!pageUrl || !token) return;
    try {
      const status = await getTranslationStatus(pageUrl, token);
      setTranslationStatus(status);
    } catch (_error) {
      // Ignore refetch errors.
    }
  }, [content, token, setTranslationStatus]);

  const handleTranslationComplete = useCallback(
    (result: { reload?: boolean }) => {
      refetchTranslationStatus();
      if (result?.reload) {
        window.location.reload();
      }
    },
    [refetchTranslationStatus],
  );

  const buildSyncActions = useCallback(() => {
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
  }, [preferredLanguage, translationStatus]);

  const startSyncWizard = useCallback(() => {
    const t = getTranslationLabels(preferredLanguage);
    const syncData = buildSyncActions();
    if (!syncData) return;

    const now = new Date().toISOString();
    const assistantMsg: ChatMessage = {
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
      messages: [...workingConversation.messages, assistantMsg],
      updatedAt: now,
    };
    updateConversationState(nextConversation, true);
  }, [
    preferredLanguage, buildSyncActions, conversationRef, conversation,
    createConversation, updateConversationState,
  ]);

  const startTranslationWizard = useCallback(() => {
    const t = getTranslationLabels(preferredLanguage);
    const now = new Date().toISOString();

    const assistantMsg: ChatMessage = {
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
      messages: [...workingConversation.messages, assistantMsg],
      updatedAt: now,
    };
    updateConversationState(nextConversation, true);
  }, [
    preferredLanguage, conversationRef, conversation,
    createConversation, updateConversationState,
  ]);

  const executeTranslationViaMessages = useCallback(
    async (
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
        const successText =
          customLabels?.success ||
          (mode === 'subtree'
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
    },
    [
      preferredLanguage, conversationRef, updateConversationState,
      pageReference, finalizeAssistant, handleTranslationComplete,
    ],
  );

  const applyTextToPage = useCallback(
    async (
      originalText: string,
      newText: string,
      pageUrl: string,
      applyingId: string,
    ) => {
      const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
      try {
        const { blocks } = await computeBlocksWithReplacement(
          pageUrl,
          originalText,
          newText,
          token,
        );
        const contentPath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        try {
          await (dispatch as any)(unlockContent(contentPath, true));
        } catch (_) {}
        await (dispatch as any)(updateContent(contentPath, { blocks }));
        try {
          await (dispatch as any)(lockContent(contentPath));
        } catch (_) {}
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
    },
    [preferredLanguage, token, dispatch, finalizeAssistant],
  );

  const handleWizardAction = useCallback(
    async (messageId: string, value: string) => {
      const current = conversationRef.current;
      if (!current) return;

      const t = getTranslationLabels(preferredLanguage);
      const sourceLanguage = translationStatus?.source_language || '';
      const now = new Date().toISOString();

      const clickedMessage = current.messages.find((m) => m.id === messageId);
      if (!clickedMessage) return;

      const messagesWithoutActions = current.messages.map((m) =>
        m.id === messageId ? { ...m, actions: undefined } : m,
      );

      const [actionType, actionValue] = value.split(':');

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
        const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
        userLabel =
          actionValue === 'apply'
            ? isDe
              ? 'Auf Seite anwenden'
              : 'Apply to page'
            : isDe
              ? 'Verwerfen'
              : 'Dismiss';
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

        const assistantMsg: ChatMessage = {
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

        nextMessages = [...nextMessages, assistantMsg];
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
      } else if (actionType === 'language') {
        const targetLang = actionValue;
        const mode = (clickedMessage?.wizardMeta?.mode || 'single') as
          | 'single'
          | 'subtree';

        const hasExisting = translationStatus?.translations?.some(
          (item) => item.language === targetLang,
        );

        if (hasExisting) {
          const langName = LANGUAGE_NAMES[targetLang] || targetLang;
          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `${t.overwriteTitle}\n\n${t.overwriteMessage(langName)}`,
            createdAt: now,
            status: 'done',
            actions: [
              {
                label: t.overwriteYes,
                value: 'overwrite:yes',
                variant: 'primary',
              },
              {
                label: t.overwriteNo,
                value: 'overwrite:no',
                variant: 'ghost',
              },
            ],
            wizardMeta: { step: 'overwrite', mode, targetLanguage: targetLang },
          };
          nextMessages = [...nextMessages, assistantMsg];
          const nextConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
        } else {
          const nextConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
          await executeTranslationViaMessages(targetLang, mode, false);
        }
      } else if (actionType === 'overwrite') {
        if (actionValue === 'no') {
          const cancelMsg: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: t.cancelled,
            createdAt: now,
            status: 'done',
          };
          nextMessages = [...nextMessages, cancelMsg];
          const nextConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
        } else {
          const targetLang =
            clickedMessage?.wizardMeta?.targetLanguage || '';
          const mode = (clickedMessage?.wizardMeta?.mode || 'single') as
            | 'single'
            | 'subtree';
          const nextConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
          await executeTranslationViaMessages(targetLang, mode, true);
        }
      } else if (actionType === 'sync') {
        const langName = LANGUAGE_NAMES[actionValue] || actionValue;
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
        await executeTranslationViaMessages(
          actionValue,
          'single',
          true,
          {
            running: t.syncRunning(langName),
            success: t.syncSuccess(langName),
          },
          true,
        );
      } else if (actionType === 'prompt') {
        const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
        const meta = clickedMessage.wizardMeta || {};

        if (actionValue === 'apply') {
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
            const nextConv = {
              ...current,
              messages: nextMessages,
              updatedAt: now,
            };
            updateConversationState(nextConv, true);
            return;
          }

          const applyingId = generateId();
          const applyingMsg: ChatMessage = {
            id: applyingId,
            role: 'assistant',
            content: isDe
              ? 'Wende Änderung auf der Seite an\u2026'
              : 'Applying changes to page\u2026',
            createdAt: now,
            status: 'streaming',
          };
          nextMessages = [...nextMessages, applyingMsg];
          const tempConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(tempConv, false);

          await applyTextToPage(
            originalText,
            assistantContent,
            pageUrl,
            applyingId,
          );
        } else if (actionValue === 'rerun') {
          const promptText = meta.promptText || '';
          if (promptText) {
            const msgIndex = current.messages.findIndex(
              (m) => m.id === messageId,
            );
            const trimmed =
              msgIndex > 0
                ? current.messages.slice(0, msgIndex)
                : messagesWithoutActions;
            const nextConv = { ...current, messages: trimmed, updatedAt: now };
            updateConversationState(nextConv, true);
            const origText = meta.originalText || '';
            const ctxOverrides = origText
              ? { mode: 'selection' as const, selection_text: origText }
              : undefined;
            handleSend(promptText, ctxOverrides, { promptText }, {
              skipUserMessage: true,
            });
          }
        } else if (actionValue === 'edit') {
          const msgIndex = current.messages.findIndex(
            (m) => m.id === messageId,
          );
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
          const msgIndex = current.messages.findIndex(
            (m) => m.id === messageId,
          );
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
          const nextConv = {
            ...current,
            messages: messagesWithoutActions,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
          return;
        }

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
          const nextConv = {
            ...current,
            messages: nextMessages,
            updatedAt: now,
          };
          updateConversationState(nextConv, true);
          return;
        }

        const applyingId = generateId();
        const applyingMsg: ChatMessage = {
          id: applyingId,
          role: 'assistant',
          content: isDe
            ? 'Wende Änderung auf der Seite an\u2026'
            : 'Applying changes to page\u2026',
          createdAt: now,
          status: 'streaming',
        };
        nextMessages = [...nextMessages, applyingMsg];
        const tempConv = {
          ...current,
          messages: nextMessages,
          updatedAt: now,
        };
        updateConversationState(tempConv, false);

        await applyTextToPage(
          originalText,
          assistantContent,
          pageUrl,
          applyingId,
        );
      } else if (actionType === 'cancel') {
        const cancelMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: t.cancelled,
          createdAt: now,
          status: 'done',
        };
        nextMessages = [...nextMessages, cancelMsg];
        const nextConv = { ...current, messages: nextMessages, updatedAt: now };
        updateConversationState(nextConv, true);
      }
    },
    [
      conversationRef, preferredLanguage, translationStatus, content,
      updateConversationState, executeTranslationViaMessages,
      applyTextToPage, setEditingMessageId, handleSend,
    ],
  );

  return {
    handleWizardAction,
    executeTranslationViaMessages,
    startSyncWizard,
    startTranslationWizard,
    buildSyncActions,
    handleTranslationComplete,
    refetchTranslationStatus,
  };
}
