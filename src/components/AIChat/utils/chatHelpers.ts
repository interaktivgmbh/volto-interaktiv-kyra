import type { Citation } from '../types';

export const generateId = () =>
  `chat_${Math.random().toString(36).slice(2, 10)}`;

export const AVAILABLE_SKILLS = [
  { name: 'design-landing-page', description: 'Landing Page aufbauen' },
  { name: 'extract-from-document', description: 'Inhalte aus Dokument extrahieren' },
  { name: 'improve-text-flow', description: 'Textfluss verbessern' },
];

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
};

export const ALL_LANGUAGES = Object.keys(LANGUAGE_NAMES);

export const getTranslationLabels = (lang?: string) => {
  const isDe = (lang || '').toLowerCase().startsWith('de');
  if (isDe) {
    return {
      scopeTitle: 'Was soll übersetzt werden?',
      scopeSingle: 'Nur diese Seite',
      scopeSubtree: 'Diese Seite + Unterseiten',
      languageTitle: 'In welche Sprache übersetzen?',
      overwriteTitle: 'Bestehende Übersetzung',
      overwriteMessage: (name: string) =>
        `Es gibt bereits eine Übersetzung auf ${name}. Überschreiben?`,
      overwriteYes: 'Ja, überschreiben',
      overwriteNo: 'Nein, abbrechen',
      running: 'Übersetzung läuft\u2026',
      successSingle: (name: string) =>
        `Übersetzung nach ${name} erfolgreich abgeschlossen.`,
      successSubtree: (name: string) =>
        `Übersetzung (inkl. Unterseiten) nach ${name} erfolgreich abgeschlossen.`,
      error: 'Übersetzung fehlgeschlagen. Bitte erneut versuchen.',
      cancelled: 'Übersetzung abgebrochen.',
      cancel: 'Abbrechen',
      syncNotice: (count: number) =>
        `${count} Übersetzung${count > 1 ? 'en sind' : ' ist'} veraltet und sollte${count > 1 ? 'n' : ''} aktualisiert werden.`,
      syncButton: (name: string) => `${name} synchronisieren`,
      syncRunning: (name: string) => `Synchronisiere ${name}\u2026`,
      syncSuccess: (name: string) => `${name} wurde erfolgreich synchronisiert.`,
      syncTitle: 'Welche Übersetzung soll synchronisiert werden?',
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

export const buildTitle = (content: string, lang?: string) => {
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
    ? ['bitte', 'aktualisiere', 'ändere', 'ersetze', 'setze', 'mache', 'füge', 'entferne', 'schreibe', 'erstelle', 'übersetze', 'zusammenfassen', 'fasse']
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

/**
 * Build citations from reference pages mentioned in the response text
 * and from file attachments that were part of the request context.
 * - Reference pages: matched by title (min 3 chars) or link path (case-insensitive)
 * - Attachments: always included as sources when present (they were used as context)
 */
export const buildCitations = (
  responseText: string,
  referencePages: Array<{ link: string; title?: string }>,
  attachmentNames: string[],
): Citation[] => {
  const citations: Citation[] = [];
  const seen = new Set<string>();

  if (responseText && referencePages.length) {
    const textLower = responseText.toLowerCase();
    for (const page of referencePages) {
      if (seen.has(page.link)) continue;
      const titleMatch = page.title && page.title.length >= 3
        && textLower.includes(page.title.toLowerCase());
      const linkMatch = page.link && textLower.includes(page.link.toLowerCase());
      if (titleMatch || linkMatch) {
        seen.add(page.link);
        citations.push({
          source_id: page.link,
          label: page.title || page.link,
          url: page.link,
          snippet: '',
        });
      }
    }
  }

  for (const name of attachmentNames) {
    const id = `attachment:${name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    citations.push({
      source_id: id,
      label: name,
      url: '',
      snippet: '',
    });
  }

  return citations;
};

/**
 * Sanitize a partial state from the Layout Agent so incomplete blocks
 * don't crash Volto's renderers during live preview.
 * - columnsBlock without data/blocks/blocks_layout -> patched with empty defaults
 * - accordion/tabs without data/blocks/blocks_layout -> patched with empty defaults
 * - Nested sub-blocks (columns, panels) without blocks/blocks_layout -> patched
 * - Blocks referenced in blocks_layout but missing from blocks -> removed from layout
 */
export const sanitizePartialState = (state: Record<string, any>, prevBlocks?: Record<string, any>): Record<string, any> => {
  if (!state.blocks || !state.blocks_layout?.items) return state;

  const blocks = { ...state.blocks };
  let items = (state.blocks_layout.items as string[]).filter((id) => !!blocks[id]);

  for (const id of Object.keys(blocks)) {
    const block = blocks[id];
    if (!block || !block['@type']) continue;

    blocks[id] = sanitizeBlock(block);

    // Some blocks (form, tabs) initialize internal React state from props
    // only on mount and never sync afterwards. When the agent creates or
    // modifies them, we force a remount by swapping the block UUID so React
    // treats them as new components.
    const needsRemount =
      (block['@type'] === 'form' && (!prevBlocks?.[id] || (
        Array.isArray(block.subblocks) && Array.isArray(prevBlocks[id]?.subblocks) &&
        block.subblocks.length !== prevBlocks[id].subblocks.length
      ))) ||
      (block['@type'] === 'tabs_block' && (!prevBlocks?.[id] || (
        JSON.stringify(block.data?.blocks_layout?.items) !==
        JSON.stringify(prevBlocks[id]?.data?.blocks_layout?.items)
      )));

    if (needsRemount) {
      const newUid = crypto.randomUUID?.() || `blk_${Math.random().toString(36).slice(2, 10)}`;
      blocks[newUid] = blocks[id];
      delete blocks[id];
      items = items.map((item) => (item === id ? newUid : item));
    }
  }

  return { ...state, blocks, blocks_layout: { items } };
};

const sanitizeBlock = (block: Record<string, any>): Record<string, any> => {
  const type = block['@type'];

  if (type === 'columnsBlock') {
    if (!block.data) return { ...block, data: { blocks: {}, blocks_layout: { items: [] } }, gridCols: block.gridCols || [] };
    const data = { ...block.data };
    if (!data.blocks) data.blocks = {};
    if (!data.blocks_layout?.items) data.blocks_layout = { items: [] };
    data.blocks_layout = { items: (data.blocks_layout.items as string[]).filter((id: string) => !!data.blocks[id]) };
    for (const colId of Object.keys(data.blocks)) {
      const col = data.blocks[colId];
      if (col && !col.blocks) data.blocks[colId] = { ...col, blocks: {}, blocks_layout: { items: [] } };
      else if (col && !col.blocks_layout?.items) data.blocks[colId] = { ...col, blocks_layout: { items: [] } };
      else if (col?.blocks && col?.blocks_layout?.items) {
        const subItems = (col.blocks_layout.items as string[]).filter((sid: string) => !!col.blocks[sid]);
        data.blocks[colId] = { ...col, blocks_layout: { items: subItems } };
      }
    }
    return { ...block, data };
  }

  if (type === 'accordion' || type === 'tabs') {
    if (!block.data) return { ...block, data: { blocks: {}, blocks_layout: { items: [] } } };
    const data = { ...block.data };
    if (!data.blocks) data.blocks = {};
    if (!data.blocks_layout?.items) data.blocks_layout = { items: [] };
    data.blocks_layout = { items: (data.blocks_layout.items as string[]).filter((id: string) => !!data.blocks[id]) };
    for (const panelId of Object.keys(data.blocks)) {
      const panel = data.blocks[panelId];
      if (panel && !panel.blocks) data.blocks[panelId] = { ...panel, blocks: {}, blocks_layout: { items: [] } };
      else if (panel && !panel.blocks_layout?.items) data.blocks[panelId] = { ...panel, blocks_layout: { items: [] } };
      else if (panel?.blocks && panel?.blocks_layout?.items) {
        const subItems = (panel.blocks_layout.items as string[]).filter((sid: string) => !!panel.blocks[sid]);
        data.blocks[panelId] = { ...panel, blocks_layout: { items: subItems } };
      }
    }
    return { ...block, data };
  }

  if (type === 'slateTable') {
    if (!block.table) return { ...block, table: { rows: [] } };
    if (!Array.isArray(block.table.rows)) return { ...block, table: { ...block.table, rows: [] } };
    return block;
  }

  if (type === 'slider' && !Array.isArray(block.slides)) return { ...block, slides: [] };
  if (type === 'carousel' && !Array.isArray(block.columns)) return { ...block, columns: [] };
  if (type === 'form' && !Array.isArray(block.subblocks)) return { ...block, subblocks: [] };

  return block;
};

export const darkenColor = (hex: string, amount: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};
