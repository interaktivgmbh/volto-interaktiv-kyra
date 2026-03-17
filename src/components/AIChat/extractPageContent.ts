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

function extractBlockText(block: ContentBlock): string {
  const type = block['@type'];

  if (type === 'title' || type === 'description') return '';

  if (type === 'slate' || type === 'text') {
    if (block.plaintext) return block.plaintext.trim();
    if (block.value) {
      const text = slateToText(block.value);
      if (text.trim()) return text.trim();
    }
    return '';
  }

  if (type === 'image') {
    const label = block.alt || block.caption || block.title || '';
    return label ? `[Image: ${label}]` : '';
  }

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

  if (type === 'columnsBlock' && block.columns) {
    return block.columns
      .map((col) => extractFromBlocksLayout(col.blocks, col.blocks_layout))
      .filter(Boolean)
      .join('\n\n');
  }

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

  if (block.data?.blocks && block.data?.blocks_layout) {
    return extractFromBlocksLayout(block.data.blocks, block.data.blocks_layout);
  }

  if (block.blocks && block.blocks_layout) {
    return extractFromBlocksLayout(block.blocks, block.blocks_layout);
  }

  if (block.plaintext) return block.plaintext.trim();
  if (typeof block.text === 'string') return block.text.trim();

  return '';
}

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

export function extractPageContent(content: ContentData | null | undefined): string {
  if (!content) return '';

  const parts: string[] = [];

  const title = content.title || content.Title || '';
  const type = content['@type'] || '';
  const description = content.description || content.Description || '';

  if (title) parts.push(`Title: ${title}`);
  if (type) parts.push(`Type: ${type}`);
  if (description) parts.push(`Description: ${description}`);

  if (parts.length > 0) parts.push('---');

  const body = extractFromBlocksLayout(content.blocks, content.blocks_layout);
  if (body) parts.push(body);

  const result = parts.join('\n');
  if (!result.trim()) return '';

  if (result.length > MAX_LENGTH) {
    return result.slice(0, MAX_LENGTH) + '\n[...content truncated]';
  }
  return result;
}
