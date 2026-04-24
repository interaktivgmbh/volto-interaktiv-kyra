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
import { detectHighlightIntent } from '../utils/highlights';
import type { ChatConversation, ChatMessage } from '../types';
import { setFormData } from '@plone/volto/actions/form/form';
import { updateContent, unlockContent, lockContent } from '@plone/volto/actions';
import {
  generateId,
  buildCitations,
  sanitizePartialState,
} from '../utils/chatHelpers';
import { resolveImageScales } from '../utils/resolveImageScales';

const IMAGE_FIELDS = ['preview_image', 'image', 'href', 'buttonLink'];

const sameImageId = (a: string, b: string) => {
  const normalize = (s: string) => s.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
  return normalize(a) === normalize(b);
};

const patchImageField = (newVal: any, oldVal: any): any => {
  if (
    Array.isArray(newVal) && newVal.length > 0 && newVal[0]?.['@id'] && !newVal[0]?.image_scales &&
    Array.isArray(oldVal) && oldVal.length > 0 && oldVal[0]?.image_scales &&
    sameImageId(newVal[0]['@id'], oldVal[0]['@id'])
  ) {
    return oldVal;
  }
  return null;
};

const patchBlockImages = (block: any, oldBlock: any): any => {
  if (!block || !oldBlock) return block;
  let result = block;

  if (typeof block.url === 'string' && typeof oldBlock.url === 'string') {
    if (sameImageId(block.url, oldBlock.url) && !block.image_scales && oldBlock.image_scales) {
      result = { ...result, image_scales: oldBlock.image_scales, image_field: oldBlock.image_field || 'image' };
    } else if (!sameImageId(block.url, oldBlock.url) && block.image_scales) {
      const { image_scales, image_field, ...rest } = result;
      result = rest;
    }
  }

  for (const field of IMAGE_FIELDS) {
    const patched = patchImageField(block[field], oldBlock[field]);
    if (patched) result = { ...result, [field]: patched };
  }
  const arrayFields = ['slides', 'columns'];
  for (const af of arrayFields) {
    if (Array.isArray(block[af]) && Array.isArray(oldBlock[af])) {
      const arr = block[af].map((item: any, i: number) => {
        const oldItem = oldBlock[af][i];
        if (!item || !oldItem) return item;
        let patched = item;
        for (const field of IMAGE_FIELDS) {
          const p = patchImageField(item[field], oldItem[field]);
          if (p) patched = { ...patched, [field]: p };
        }
        return patched;
      });
      result = { ...result, [af]: arr };
    }
  }
  return result;
};

const preserveImageData = (
  newState: Record<string, any>,
  oldFormData: Record<string, any>,
): Record<string, any> => {
  if (!newState?.blocks || !oldFormData?.blocks) return newState;
  const blocks = { ...newState.blocks };
  for (const [id, block] of Object.entries(blocks)) {
    if (typeof block !== 'object' || !block) continue;
    const oldBlock = oldFormData.blocks[id];
    if (oldBlock) {
      blocks[id] = patchBlockImages(block, oldBlock);
    }
  }
  return { ...newState, blocks };
};
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
  /** Block IDs currently part of a multi-block selection (Ctrl+click). Empty
   *  when the selection was a native text selection or none is active. */
  selectedBlockIdsRef: React.MutableRefObject<string[]>;
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
  ): Promise<string | false> => {
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
      selectedBlockIdsRef,
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
      const reviewState = content?.review_state;
      if (reviewState) pageState.review_state = reviewState;

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

      const wantsHighlight = detectHighlightIntent(contentText);

      let jobId: string;
      const buildMessagePayload = () => {
        const selectedBlockIds = Array.isArray(selectedBlockIdsRef?.current)
          ? selectedBlockIdsRef.current.filter((v) => typeof v === 'string' && v)
          : [];
        const hasMultiBlockScope = selectedBlockIds.length >= 2;

        let msgText = contentText;
        if (hasMultiBlockScope) {
          const scopeNote = isDe
            ? `\n\n[SCOPE — STRIKT BEFOLGEN: Die Änderungen dürfen AUSSCHLIESSLICH auf die folgenden ${selectedBlockIds.length} Blöcke angewendet werden. Keine anderen Blöcke auf der Seite modifizieren, hinzufügen oder löschen. Block-IDs: ${selectedBlockIds.join(', ')}]`
            : `\n\n[SCOPE — STRICTLY FOLLOW: Apply changes ONLY to the following ${selectedBlockIds.length} blocks. Do not modify, add, or delete any other blocks on the page. Block IDs: ${selectedBlockIds.join(', ')}]`;
          msgText += scopeNote;
        }
        if (wantsHighlight) {
          msgText += '\n\n[System: After your analysis, include a line starting with "Markierte Wörter:" followed by a comma-separated list of ONLY the words/phrases from the actual page content that are directly related to what the user asked to highlight. Be very selective — only include words that match the user\'s specific request, not all issues you find. Example: "Markierte Wörter: H3 Überschrift, H2 Überschrift"]';
        }
        const mp: {
          message: string;
          context?: {
            text?: string;
            block_id?: string;
            block_ids?: string[];
            scope?: string;
          };
        } = { message: msgText };
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
        if (contextParts.length > 0 || hasMultiBlockScope) {
          mp.context = {};
          if (contextParts.length > 0) {
            mp.context.text = contextParts.join('\n\n---\n\n');
          }
          if (hasMultiBlockScope) {
            mp.context.block_ids = selectedBlockIds;
            mp.context.scope = 'selected_blocks';
          }
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

                if (msg.role === 'assistant') {
                  const hasTools = msg.tool_calls && msg.tool_calls.length > 0;
                  if (msg.content && msg.content.trim() && hasTools) {
                    toolCalls = [...toolCalls, { name: '', description: msg.content.trim(), type: 'message' as const }];
                  }
                  if (hasTools) {
                    for (const tc of msg.tool_calls) {
                      toolCalls = [...toolCalls, { ...tc, type: 'tool' as const }];
                    }
                  }
                  const lastEntry = toolCalls[toolCalls.length - 1];
                  if (lastEntry) {
                    applyAssistantUpdate(editAssistantId, (m) => ({
                      ...m,
                      content: lastEntry.description || lastEntry.name,
                      toolCalls: toolCalls,
                    }));
                  }
                }

                if (msg.state && isVoltoEditMode && formData) {
                  try {
                    const merged = preserveImageData(msg.state, formData);
                    const sanitized = sanitizePartialState(merged, formData?.blocks);
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
                    resolveImageScales(sanitized, token).then((resolved) => {
                      if (resolved !== sanitized) {
                        const patched = { ...liveFormData, blocks: resolved.blocks || liveFormData.blocks };
                        dispatch(setFormData(patched));
                      }
                    }).catch(() => {});
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

      if (result.state && formData) {
        result.state = preserveImageData(result.state, formData);
        try {
          result.state = await resolveImageScales(result.state, token);
        } catch (_err) {}
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
      return successMsg;
    } catch (err: any) {
      finalizeAssistant(editAssistantId, {
        content: isDe
          ? `Fehler: ${err?.message || 'Unbekannter Fehler'}`
          : `Error: ${err?.message || 'Unknown error'}`,
        status: 'error',
      });
      return '';
    } finally {
      layoutJobAbortRef.current = null;
      setIsSending(false);
    }
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
