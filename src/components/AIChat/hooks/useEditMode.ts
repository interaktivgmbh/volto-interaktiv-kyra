import { useCallback, useRef } from 'react';
import {
  prepareBlocksForEditMode,
  createLayoutConversation,
  fetchReferencePages,
  sendLayoutMessage,
  pollLayoutJob,
  cancelLayoutJob,
  createChatConversation,
  sendChatMessage,
  pollChatJob,
  cancelChatJob,
  getEditMessages,
  getChatMessages,
} from '../api';
import type { ChatConversation, ChatMessage } from '../types';
import { setFormData } from '@plone/volto/actions/form/form';
import { updateContent, unlockContent, lockContent } from '@plone/volto/actions';
import {
  generateId,
  buildCitations,
  sanitizePartialState,
} from '../utils/chatHelpers';
import { saveEditConvId, loadEditConvId } from './useConversation';

interface UseEditModeDeps {
  editBackendUrl: string;
  token: string | undefined;
  content: any;
  formData: any;
  dispatch: any;
  isVoltoEditMode: boolean;
  editModeActiveRef: React.MutableRefObject<boolean>;
  preferredLanguage: string;
  selectionTextRef: React.MutableRefObject<string>;
  pageContentText: string;
  attachments: { name: string; id: string; file_id: string; text?: string }[];
  applyAssistantUpdate: (
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage,
    persist?: boolean,
    previousId?: string,
  ) => void;
  finalizeAssistant: (
    assistantId: string,
    data: {
      content?: string;
      citations?: ChatMessage['citations'];
      status?: ChatMessage['status'];
      conversationId?: string;
      actions?: ChatMessage['actions'];
      wizardMeta?: ChatMessage['wizardMeta'];
      toolCalls?: ChatMessage['toolCalls'];
    },
    previousId?: string,
  ) => void;
  updateConversationState: (
    nextConversation: ChatConversation,
    persist?: boolean,
    previousId?: string,
  ) => void;
  setIsSending: (value: boolean) => void;
}

export function useEditMode(deps: UseEditModeDeps) {
  const layoutConversationIdRef = useRef<string | null>(null);
  const chatConversationIdRef = useRef<string | null>(null);
  const referencePagesRef = useRef<Array<{ link: string; title?: string }>>([]);
  const layoutJobAbortRef = useRef<(() => void) | null>(null);

  const restoreConversationIds = useCallback((uid: string | undefined) => {
    if (uid) {
      layoutConversationIdRef.current = loadEditConvId('layout', uid);
      chatConversationIdRef.current = loadEditConvId('chat', uid);
    } else {
      layoutConversationIdRef.current = null;
      chatConversationIdRef.current = null;
    }
    referencePagesRef.current = [];
  }, []);

  const clearConversationIds = useCallback((uid: string | undefined) => {
    layoutConversationIdRef.current = null;
    chatConversationIdRef.current = null;
    if (uid) {
      saveEditConvId('layout', uid, null);
      saveEditConvId('chat', uid, null);
    }
  }, []);

  const cancelLayoutJobIfRunning = useCallback(() => {
    if (layoutJobAbortRef.current) {
      layoutJobAbortRef.current();
    }
  }, []);

  /**
   * Send a message through the edit-engine backend (layout or chat conversation).
   * Returns true if it handled the message, false if the caller should fall through
   * to the regular chat path.
   */
  const sendEditMessage = useCallback(async (
    contentText: string,
    workingConversation: ChatConversation,
    now: string,
  ): Promise<boolean> => {
    const {
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
    } = deps;

    if (!editBackendUrl) return false;

    const isEditMode = editModeActiveRef.current;
    const isDe = (preferredLanguage || '').toLowerCase().startsWith('de');
    const editAssistantId = generateId();
    const editAssistantMsg: ChatMessage = {
      id: editAssistantId,
      role: 'assistant',
      content: isDe ? 'Seite wird analysiert\u2026' : 'Analyzing page\u2026',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };
    updateConversationState(
      { ...workingConversation, messages: [...workingConversation.messages, editAssistantMsg], updatedAt: now },
      false,
    );
    setIsSending(true);

    const aborted = { current: false };
    layoutJobAbortRef.current = () => { aborted.current = true; };

    try {
      const pageUrl = content?.['@id'] || '';
      const pagePath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
      const { blocks, blocks_layout, title, description, preview_image, subjects } = await prepareBlocksForEditMode(pageUrl, token);
      const pageState: Record<string, any> = { blocks, blocks_layout, link: pagePath };
      if (title) pageState.title = title;
      if (description) pageState.description = description;
      if (preview_image) pageState.preview_image = preview_image;
      if (subjects && subjects.length > 0) pageState.subjects = subjects;

      const activeConvRef = editModeActiveRef.current ? layoutConversationIdRef : chatConversationIdRef;
      if (!activeConvRef.current) {
        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Lade Seitenkontext\u2026' : 'Loading page context\u2026',
        }));

        let referencePages: any[] = [];
        try {
          referencePages = await fetchReferencePages(pageUrl, token);
          referencePagesRef.current = referencePages.map((p: any) => ({ link: p.link, title: p.title }));
        } catch (_err) {
          console.error('[Kyra] Reference pages error:', _err);
        }

        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Verbinde mit KI\u2026' : 'Connecting to AI\u2026',
        }));
        const convPayload = {
          schema: 'volto',
          version: 'vanilla',
          state: pageState,
          permissions: editModeActiveRef.current ? ['update', 'create', 'delete', 'move'] : [],
          language: (preferredLanguage || 'de').slice(0, 2),
          ...(referencePages.length > 0 ? { reference_pages: referencePages } : {}),
        };
        const convResponse = isEditMode
          ? await createLayoutConversation(editBackendUrl, convPayload, token)
          : await createChatConversation(convPayload, token);
        activeConvRef.current = convResponse.conversation_id;
        const pageUid = content?.UID;
        if (pageUid) {
          const kind = editModeActiveRef.current ? 'layout' : 'chat';
          saveEditConvId(kind, pageUid, convResponse.conversation_id);
        }
      }

      applyAssistantUpdate(editAssistantId, (m) => ({
        ...m,
        content: isDe ? 'Deine Anfrage wird verarbeitet\u2026' : 'Processing your request\u2026',
      }));

      let jobId: string;
      const buildMessagePayload = () => {
        const mp: { message: string; context?: { text?: string; block_id?: string } } = { message: contentText };
        const activeSelection = selectionTextRef.current;
        const contextParts: string[] = [];
        if (activeSelection && activeSelection.length > 5) {
          contextParts.push(activeSelection);
        } else if (!editModeActiveRef.current && pageContentText) {
          contextParts.push(pageContentText);
        }
        const attachmentTexts = attachments
          .filter((a) => a.text && a.text.trim())
          .map((a) => `[File: ${a.name}]\n${a.text}`)
          .join('\n\n');
        if (attachmentTexts) {
          contextParts.push(attachmentTexts);
        }
        if (contextParts.length > 0) {
          mp.context = { text: contextParts.join('\n\n---\n\n') };
        }
        return mp;
      };

      try {
        const messagePayload = buildMessagePayload();
        const msgResponse = isEditMode
          ? await sendLayoutMessage(editBackendUrl, activeConvRef.current, messagePayload, token)
          : await sendChatMessage(activeConvRef.current, messagePayload, token);
        jobId = msgResponse.job_id;
      } catch (sendErr: any) {
        const isNotFound = (sendErr?.message || '').includes('not found') ||
          (sendErr?.message || '').includes('404');
        if (isNotFound) {
          try {
            applyAssistantUpdate(editAssistantId, (m) => ({
              ...m,
              content: isDe ? 'Sitzung wird wiederhergestellt\u2026' : 'Restoring session\u2026',
            }));
            const retryConvPayload = {
              schema: 'volto' as const,
              version: 'vanilla' as const,
              state: pageState,
              permissions: editModeActiveRef.current ? ['update', 'create', 'delete', 'move'] : [],
              language: (preferredLanguage || 'de').slice(0, 2),
              ...(referencePagesRef.current.length > 0 ? { reference_pages: referencePagesRef.current } : {}),
            };
            const retryConv = isEditMode
              ? await createLayoutConversation(editBackendUrl, retryConvPayload, token)
              : await createChatConversation(retryConvPayload, token);
            activeConvRef.current = retryConv.conversation_id;
            const retryUid = content?.UID;
            if (retryUid) {
              saveEditConvId(editModeActiveRef.current ? 'layout' : 'chat', retryUid, retryConv.conversation_id);
            }
            const retryMsg = buildMessagePayload();
            const retryResponse = isEditMode
              ? await sendLayoutMessage(editBackendUrl, activeConvRef.current, retryMsg, token)
              : await sendChatMessage(activeConvRef.current, retryMsg, token);
            jobId = retryResponse.job_id;
          } catch (retryErr: any) {
            activeConvRef.current = null;
            const rUid = content?.UID;
            if (rUid) saveEditConvId(editModeActiveRef.current ? 'layout' : 'chat', rUid, null);
            finalizeAssistant(editAssistantId, {
              content: isDe
                ? `Die KI ist gerade nicht erreichbar (${retryErr?.message || 'Netzwerkfehler'}).`
                : `AI is currently unreachable (${retryErr?.message || 'network error'}).`,
              status: 'done',
            });
            return true;
          }
        } else {
          const debugPayload = { schema: 'volto', version: 'vanilla', state: pageState, message: contentText };
          const blob = new Blob([JSON.stringify(debugPayload, null, 2)], { type: 'application/json' });
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `edit-payload-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          activeConvRef.current = null;
          const errUid = content?.UID;
          if (errUid) {
            const errKind = editModeActiveRef.current ? 'layout' : 'chat';
            saveEditConvId(errKind, errUid, null);
          }
          finalizeAssistant(editAssistantId, {
            content: isDe
              ? `Die KI ist gerade nicht erreichbar (${sendErr?.message || 'Netzwerkfehler'}). Der Payload wurde als Datei gespeichert.`
              : `AI is currently unreachable (${sendErr?.message || 'network error'}). The payload has been saved as a file.`,
            status: 'done',
          });
          return true;
        }
      }

      const pollUntilDone = async (): Promise<{ status: string; message?: string; state?: Record<string, any>; error?: string; toolCalls?: Array<{ name: string; description: string }> }> => {
        const getMessages = isEditMode ? getEditMessages : getChatMessages;
        const convId = activeConvRef.current;

        let userMessageUid = '';
        if (convId) {
          try {
            const currentMessages = await getMessages(convId, undefined, token);
            const lastUser = [...currentMessages].reverse().find(m => m.role === 'user');
            if (lastUser) userMessageUid = lastUser.uid;
          } catch (_err) {}
        }

        let lastPolledUid = userMessageUid;
        let toolCalls: Array<{ name: string; description: string }> = [];
        let latestState: Record<string, any> | undefined;

        while (!aborted.current) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
          if (aborted.current) break;

          const jobStatus = isEditMode
            ? await pollLayoutJob(editBackendUrl, jobId, token)
            : await pollChatJob(jobId, token);

          try {
            if (convId) {
              const newMessages = await getMessages(convId, lastPolledUid || undefined, token);
              for (const msg of newMessages) {
                lastPolledUid = msg.uid;
                if (msg.state) latestState = msg.state;

                if (msg.role === 'assistant' && msg.tool_calls?.length) {
                  toolCalls = msg.tool_calls;
                  const lastTool = msg.tool_calls[msg.tool_calls.length - 1];
                  applyAssistantUpdate(editAssistantId, (m) => ({
                    ...m,
                    content: lastTool.description || lastTool.name,
                    toolCalls: toolCalls,
                  }));
                }

                if (msg.state && isVoltoEditMode && formData) {
                  try {
                    const sanitized = sanitizePartialState(msg.state, formData?.blocks);
                    const liveFormData = { ...formData };
                    if (sanitized.blocks && Object.keys(sanitized.blocks).length > 0) {
                      liveFormData.blocks = sanitized.blocks;
                      if (sanitized.blocks_layout) liveFormData.blocks_layout = sanitized.blocks_layout;
                    }
                    if (sanitized.title !== undefined) liveFormData.title = sanitized.title;
                    if (sanitized.description !== undefined) liveFormData.description = sanitized.description;
                    if (sanitized.preview_image !== undefined) liveFormData.preview_image = sanitized.preview_image;
                    if (sanitized.subjects !== undefined) liveFormData.subjects = sanitized.subjects;
                    dispatch(setFormData(liveFormData));
                  } catch (_err) {}
                }
              }
            }
          } catch (_err) {}

          if (jobStatus.status !== 'running') {
            let finalMessage = '';
            let finalState = latestState;
            let finalToolCalls = toolCalls;
            try {
              if (convId) {
                const afterMessages = await getMessages(convId, userMessageUid || undefined, token);
                const lastAssistant = [...afterMessages].reverse().find(m => m.role === 'assistant' && m.content);
                if (lastAssistant) {
                  finalMessage = lastAssistant.content || '';
                  if (lastAssistant.state) finalState = lastAssistant.state;
                  if (finalToolCalls.length === 0 && lastAssistant.tool_calls?.length) {
                    finalToolCalls = lastAssistant.tool_calls;
                  }
                }
              }
            } catch (_err) {}

            return {
              status: jobStatus.status,
              message: finalMessage,
              state: finalState,
              error: jobStatus.status === 'failed' ? (jobStatus as any).error : undefined,
              toolCalls: finalToolCalls,
            };
          }
        }

        await (isEditMode
          ? cancelLayoutJob(editBackendUrl, jobId, token)
          : cancelChatJob(jobId, token)
        ).catch(() => {});
        return { status: 'cancelled' };
      };

      const result = await pollUntilDone();
      layoutJobAbortRef.current = null;

      if (result.status === 'cancelled') {
        finalizeAssistant(editAssistantId, {
          content: isDe ? 'Abgebrochen.' : 'Cancelled.',
          status: 'done',
        });
        return true;
      }

      if (result.status === 'failed') {
        finalizeAssistant(editAssistantId, {
          content: isDe
            ? `Fehler: ${result.error || 'Unbekannter Fehler'}`
            : `Error: ${result.error || 'Unknown error'}`,
          status: 'error',
        });
        return true;
      }

      const hasBlocks = result.state?.blocks && Object.keys(result.state.blocks).length > 0;
      const hasMetadata = result.state?.title !== undefined
        || result.state?.description !== undefined
        || result.state?.preview_image !== undefined
        || result.state?.subjects !== undefined;
      const hasChanges = hasBlocks || hasMetadata;
      if (hasChanges && isVoltoEditMode && formData) {
        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Änderungen werden in die Bearbeitung übernommen\u2026' : 'Applying changes to the editor\u2026',
        }));
        const sanitizedResult = sanitizePartialState(result.state!, formData?.blocks);
        const updatedFormData = { ...formData };
        if (hasBlocks) {
          updatedFormData.blocks = sanitizedResult.blocks || result.state!.blocks;
          if (sanitizedResult.blocks_layout || result.state!.blocks_layout) {
            updatedFormData.blocks_layout = sanitizedResult.blocks_layout || result.state!.blocks_layout;
          }
        }
        if (result.state!.title !== undefined) updatedFormData.title = result.state!.title;
        if (result.state!.description !== undefined) updatedFormData.description = result.state!.description;
        if (result.state!.preview_image !== undefined) updatedFormData.preview_image = result.state!.preview_image;
        if (result.state!.subjects !== undefined) updatedFormData.subjects = result.state!.subjects;
        dispatch(setFormData(updatedFormData));
      } else if (hasChanges) {
        applyAssistantUpdate(editAssistantId, (m) => ({
          ...m,
          content: isDe ? 'Änderungen werden auf der Seite übernommen\u2026' : 'Applying changes to the page\u2026',
        }));
        const contentPath = pageUrl.replace(/^https?:\/\/[^/]+/, '');
        const patch: Record<string, any> = {};
        if (hasBlocks) {
          patch.blocks = result.state!.blocks;
          if (result.state!.blocks_layout) {
            patch.blocks_layout = result.state!.blocks_layout;
          }
        }
        if (result.state!.title !== undefined) patch.title = result.state!.title;
        if (result.state!.description !== undefined) patch.description = result.state!.description;
        if (result.state!.preview_image !== undefined) patch.preview_image = result.state!.preview_image;
        if (result.state!.subjects !== undefined) patch.subjects = result.state!.subjects;
        try { await (dispatch as any)(unlockContent(contentPath, true)); } catch (_) {}
        await (dispatch as any)(updateContent(contentPath, patch));
        try { await (dispatch as any)(lockContent(contentPath)); } catch (_) {}
      }

      const successMsg = result.message
        || (hasChanges
          ? (isVoltoEditMode
            ? (isDe ? 'Änderungen in der Bearbeitung sichtbar. Bitte manuell speichern.' : 'Changes visible in the editor. Please save manually.')
            : (isDe ? 'Änderungen erfolgreich angewendet.' : 'Changes applied successfully.'))
          : (isDe ? 'Keine Antwort erhalten.' : 'No response received.'));
      const citations = buildCitations(
        successMsg,
        referencePagesRef.current,
        attachments.filter((a) => a.file_id).map((a) => a.name),
      );
      finalizeAssistant(editAssistantId, { content: successMsg, citations, status: 'done', toolCalls: result.toolCalls, stateSnapshot: result.state });
    } catch (err: any) {
      finalizeAssistant(editAssistantId, {
        content: isDe
          ? `Fehler: ${err?.message || 'Unbekannter Fehler'}`
          : `Error: ${err?.message || 'Unknown error'}`,
        status: 'error',
      });
    } finally {
      layoutJobAbortRef.current = null;
      setIsSending(false);
    }
    return true;
  }, [deps]);

  return {
    layoutConversationIdRef,
    chatConversationIdRef,
    referencePagesRef,
    layoutJobAbortRef,
    sendEditMessage,
    restoreConversationIds,
    clearConversationIds,
    cancelLayoutJobIfRunning,
  };
}
