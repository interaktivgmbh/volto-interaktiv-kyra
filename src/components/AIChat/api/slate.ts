import { buildApiUrl, buildHeaders } from './core';

export function extractSlateText(nodes: any[]): string {
  return nodes
    .map((node) => {
      if (typeof node.text === 'string') return node.text;
      if (node.children) return extractSlateText(node.children);
      return '';
    })
    .join('');
}

export const normalizeWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

export function replaceInSlateNodes(
  nodes: any[],
  original: string,
  replacement: string,
): { result: any[]; replaced: boolean } {
  const fullText = extractSlateText(nodes);
  let idx = fullText.indexOf(original);

  if (idx === -1) {
    const normFull = normalizeWhitespace(fullText);
    const normOrig = normalizeWhitespace(original);
    const normIdx = normFull.indexOf(normOrig);
    if (normIdx === -1) return { result: nodes, replaced: false };

    let ni = 0;
    let oi = 0;
    while (ni < normIdx && oi < fullText.length) {
      if (/\s/.test(fullText[oi])) {
        while (oi < fullText.length && /\s/.test(fullText[oi])) oi++;
        ni++;
      } else {
        oi++;
        ni++;
      }
    }
    const startOi = oi;
    let remaining = normOrig.length;
    while (remaining > 0 && oi < fullText.length) {
      if (/\s/.test(fullText[oi])) {
        while (oi < fullText.length && /\s/.test(fullText[oi])) oi++;
        remaining--;
      } else {
        oi++;
        remaining--;
      }
    }
    original = fullText.substring(startOi, oi);
    idx = startOi;
  }

  const cloned: any[] = JSON.parse(JSON.stringify(nodes));

  type Leaf = { node: any; start: number; end: number };
  const leaves: Leaf[] = [];
  let pos = 0;

  const walk = (list: any[]) => {
    for (const n of list) {
      if (typeof n.text === 'string') {
        leaves.push({ node: n, start: pos, end: pos + n.text.length });
        pos += n.text.length;
      } else if (n.children) {
        walk(n.children);
      }
    }
  };
  walk(cloned);

  const matchEnd = idx + original.length;
  let inserted = false;

  for (const leaf of leaves) {
    if (leaf.end <= idx || leaf.start >= matchEnd) continue;

    const before =
      leaf.start < idx ? leaf.node.text.substring(0, idx - leaf.start) : '';
    const after =
      leaf.end > matchEnd
        ? leaf.node.text.substring(matchEnd - leaf.start)
        : '';

    if (!inserted) {
      leaf.node.text = before + replacement + after;
      inserted = true;
    } else {
      leaf.node.text = after;
    }
  }

  return { result: cloned, replaced: true };
}

/**
 * Fetches the page content and computes updated blocks with the text replaced.
 * Returns { blocks } ready to be PATCHed via Volto's updateContent action.
 */
export const computeBlocksWithReplacement = async (
  pageUrl: string,
  originalText: string,
  newText: string,
  token?: string,
): Promise<{ blocks: Record<string, any> }> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const getResponse = await fetch(buildApiUrl(path), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!getResponse.ok) throw new Error('Failed to fetch page content');
  const pageData = await getResponse.json();

  const blocks = pageData.blocks;
  const blocksLayout = pageData.blocks_layout;
  if (!blocks || !blocksLayout?.items) throw new Error('No blocks found');

  const cleanText = newText.replace(/<[^>]+>/g, '').trim();

  const updatedBlocks = { ...blocks };
  let modified = false;

  const slateFields = ['value', 'description', 'title'];

  for (const blockId of blocksLayout.items) {
    const block = blocks[blockId];
    if (!block) continue;
    if (modified) break;

    for (const field of slateFields) {
      const slateValue = block[field];
      if (!Array.isArray(slateValue)) continue;

      const { result, replaced } = replaceInSlateNodes(
        slateValue,
        originalText,
        cleanText,
      );
      if (replaced) {
        updatedBlocks[blockId] = { ...block, [field]: result };
        modified = true;
        break;
      }
    }

    if (!modified) {
      const stringFields = ['plaintext', 'head_title', 'citation'];
      for (const field of stringFields) {
        if (typeof block[field] === 'string' && block[field].includes(originalText)) {
          updatedBlocks[blockId] = {
            ...block,
            [field]: block[field].replace(originalText, cleanText),
          };
          modified = true;
          break;
        }
        if (
          typeof block[field] === 'string' &&
          normalizeWhitespace(block[field]).includes(normalizeWhitespace(originalText))
        ) {
          updatedBlocks[blockId] = {
            ...block,
            [field]: block[field].replace(
              new RegExp(originalText.replace(/\s+/g, '\\s+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
              cleanText,
            ),
          };
          modified = true;
          break;
        }
      }
    }
  }

  if (!modified) {
    const origParagraphs = originalText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const newParagraphs = cleanText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

    if (origParagraphs.length > 1) {
      const replacements: { blockId: string; field: string; origPara: string; newPara: string }[] = [];

      for (let i = 0; i < origParagraphs.length; i++) {
        const origPara = origParagraphs[i];
        const newPara = i < newParagraphs.length ? newParagraphs[i] : '';
        let found = false;

        for (const blockId of blocksLayout.items) {
          const block = updatedBlocks[blockId];
          if (!block) continue;

          for (const field of slateFields) {
            const slateValue = block[field];
            if (!Array.isArray(slateValue)) continue;
            const blockText = extractSlateText(slateValue);
            if (
              blockText.includes(origPara) ||
              normalizeWhitespace(blockText).includes(normalizeWhitespace(origPara))
            ) {
              replacements.push({ blockId, field, origPara, newPara });
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      if (replacements.length > 0) {
        for (const rep of replacements) {
          const block = updatedBlocks[rep.blockId];
          const slateValue = block[rep.field];
          if (!Array.isArray(slateValue)) continue;
          const { result, replaced } = replaceInSlateNodes(slateValue, rep.origPara, rep.newPara);
          if (replaced) {
            updatedBlocks[rep.blockId] = { ...block, [rep.field]: result };
            modified = true;
          }
        }
      }
    }
  }

  if (!modified) throw new Error('Original text not found in page blocks');

  return { blocks: updatedBlocks };
};
