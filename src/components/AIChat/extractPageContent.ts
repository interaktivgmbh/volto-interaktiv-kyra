/**
 * Extracts structured, readable text from a Volto content object
 * for sending as page_content to the AI chat backend.
 */

const MAX_LENGTH = 15000;

type SlateNode = {
  text?: string;
  children?: SlateNode[];
};

type ContentBlock = {
  '@type'?: string;
  plaintext?: string;
  value?: any;
  text?: string;
  alt?: string;
  caption?: string;
  title?: string;
  description?: string;
  table?: {
    rows?: Array<{
      cells?: Array<{
        value?: any;
      }>;
    }>;
  };
  data?: {
    blocks?: Record<string, ContentBlock>;
    blocks_layout?: { items?: string[] };
  };
  blocks?: Record<string, ContentBlock>;
  blocks_layout?: { items?: string[] };
  columns?: Array<{
    blocks?: Record<string, ContentBlock>;
    blocks_layout?: { items?: string[] };
  }>;
  tabs?: Array<{
    title?: string;
    blocks?: Record<string, ContentBlock>;
    blocks_layout?: { items?: string[] };
  }>;
  [key: string]: any;
};

type ContentData = {
  title?: string;
  Title?: string;
  '@type'?: string;
  description?: string;
  Description?: string;
  blocks?: Record<string, ContentBlock>;
  blocks_layout?: { items?: string[] };
  [key: string]: any;
};

/** Recursively extract plain text from Slate JSON nodes. */
function slateToText(nodes: SlateNode | SlateNode[]): string {
  const arr = Array.isArray(nodes) ? nodes : [nodes];
  return arr
    .map((node) => {
      if (typeof node.text === 'string') return node.text;
      if (node.children) return slateToText(node.children);
      return '';
    })
    .join('');
}

/** Extract text from a single Volto block. */
export function extractBlockText(block: ContentBlock): string {
  const type = block['@type'];

  // Skip title/description blocks — already in metadata header
  if (type === 'title' || type === 'description') return '';

  // Slate / text blocks
  if (type === 'slate' || type === 'text') {
    if (block.plaintext) return block.plaintext.trim();
    if (block.value) {
      const text = slateToText(block.value);
      if (text.trim()) return text.trim();
    }
    return '';
  }

  // Image blocks
  if (type === 'image') {
    const label = block.alt || block.caption || block.title || '';
    return label ? `[Image: ${label}]` : '';
  }

  // Table blocks
  if (type === 'table' && block.table?.rows) {
    const rows = block.table.rows;
    const textRows = rows.map((row) => {
      const cells = (row.cells || []).map((cell) => {
        if (!cell.value) return '';
        return slateToText(cell.value).trim();
      });
      return `| ${cells.join(' | ')} |`;
    });
    if (textRows.length > 1) {
      const headerSep = `| ${(rows[0]?.cells || []).map(() => '---').join(' | ')} |`;
      return [textRows[0], headerSep, ...textRows.slice(1)].join('\n');
    }
    return textRows.join('\n');
  }

  // Container: columns
  if (type === 'columnsBlock' && block.columns) {
    return block.columns
      .map((col) => extractFromBlocksLayout(col.blocks, col.blocks_layout))
      .filter(Boolean)
      .join('\n\n');
  }

  // Container: tabs / accordion
  if ((type === 'tabs' || type === 'accordion') && block.tabs) {
    return block.tabs
      .map((tab) => {
        const heading = tab.title ? `## ${tab.title}` : '';
        const body = extractFromBlocksLayout(tab.blocks, tab.blocks_layout);
        return [heading, body].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  // Generic container with nested data.blocks
  if (block.data?.blocks && block.data?.blocks_layout) {
    return extractFromBlocksLayout(block.data.blocks, block.data.blocks_layout);
  }

  // Generic container with nested blocks
  if (block.blocks && block.blocks_layout) {
    return extractFromBlocksLayout(block.blocks, block.blocks_layout);
  }

  // Fallback: try common text fields
  if (block.plaintext) return block.plaintext.trim();
  if (typeof block.text === 'string') return block.text.trim();

  return '';
}

/** Extract text from blocks in layout order. */
function extractFromBlocksLayout(
  blocks?: Record<string, ContentBlock>,
  blocksLayout?: { items?: string[] },
): string {
  if (!blocks || !blocksLayout?.items) return '';
  return blocksLayout.items
    .map((id) => {
      const block = blocks[id];
      if (!block) return '';
      return extractBlockText(block);
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Extract text from an arbitrary list of block IDs, preserving layout order
 * where possible. Used for Volto's multi-block selection (Ctrl+click) so the
 * chat can treat several blocks as a unified selection context.
 */
export function extractBlocksByIds(
  blocks: Record<string, ContentBlock> | undefined,
  blocksLayout: { items?: string[] } | undefined,
  ids: string[] | undefined,
): string {
  if (!blocks || !ids || ids.length === 0) return '';
  const layoutOrder = blocksLayout?.items || [];
  const orderIndex = new Map<string, number>();
  layoutOrder.forEach((id, idx) => orderIndex.set(id, idx));
  const sortedIds = [...ids].sort((a, b) => {
    const ia = orderIndex.has(a) ? (orderIndex.get(a) as number) : Number.MAX_SAFE_INTEGER;
    const ib = orderIndex.has(b) ? (orderIndex.get(b) as number) : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  return sortedIds
    .map((id) => {
      const block = blocks[id];
      return block ? extractBlockText(block) : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Main entry: extract structured page text from Volto content data. */
export function extractPageContent(content: ContentData | null | undefined): string {
  if (!content) return '';

  const parts: string[] = [];

  // Metadata header
  const title = content.title || content.Title || '';
  const type = content['@type'] || '';
  const description = content.description || content.Description || '';

  if (title) parts.push(`Title: ${title}`);
  if (type) parts.push(`Type: ${type}`);
  if (description) parts.push(`Description: ${description}`);

  if (parts.length > 0) parts.push('---');

  // Body blocks
  const body = extractFromBlocksLayout(content.blocks, content.blocks_layout);
  if (body) parts.push(body);

  const result = parts.join('\n');
  if (!result.trim()) return '';

  if (result.length > MAX_LENGTH) {
    return result.slice(0, MAX_LENGTH) + '\n[...content truncated]';
  }
  return result;
}
