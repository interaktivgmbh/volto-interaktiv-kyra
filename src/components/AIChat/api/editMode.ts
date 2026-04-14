import { buildApiUrl, buildHeaders } from './core';

export type LayoutJobStatus =
  | { status: 'running' }
  | { status: 'completed' }
  | { status: 'failed'; error?: string }
  | { status: 'cancelled' };

export type AgentMessage = {
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: Array<{ name: string; description: string }>;
  state?: Record<string, any>;
};

export type SkillInfo = {
  name: string;
  description: string;
  invocation: string;
};

export type ReferencePage = {
  link: string;
  title?: string;
  description?: string;
  preview_image?: string;
  subjects?: string[];
  blocks: Record<string, any>;
  blocks_layout: { items: string[] };
};

export const resolveListingBlockItems = async (
  querystring: Record<string, any>,
  contextPath: string,
  token?: string,
): Promise<any[]> => {
  const response = await fetch(buildApiUrl(`${contextPath}/@querystring-search`), {
    method: 'POST',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(querystring),
  });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    '@id': item['@id'],
    '@type': item['@type'],
    title: item.title,
    description: item.description,
    preview_image: item.preview_image || item.image || null,
  }));
};

const resolveListingsInBlocks = async (
  blocks: Record<string, any>,
  layoutItems: string[],
  contextPath: string,
  token?: string,
): Promise<Record<string, any>> => {
  const resolved = { ...blocks };

  for (const id of layoutItems) {
    const block = blocks[id];
    if (!block) continue;

    if (block['@type'] === 'listing' && block.querystring) {
      const items = await resolveListingBlockItems(block.querystring, contextPath, token);
      resolved[id] = { ...block, items };
    }

    if (block.blocks && block.blocks_layout?.items) {
      const nested = await resolveListingsInBlocks(
        block.blocks, block.blocks_layout.items, contextPath, token,
      );
      resolved[id] = { ...resolved[id], blocks: nested };
    }
    if (block.data?.blocks && block.data?.blocks_layout?.items) {
      const nested = await resolveListingsInBlocks(
        block.data.blocks, block.data.blocks_layout.items, contextPath, token,
      );
      resolved[id] = {
        ...resolved[id],
        data: { ...block.data, blocks: nested },
      };
    }
  }

  return resolved;
};

export const prepareBlocksForEditMode = async (
  pageUrl: string,
  token?: string,
): Promise<{
  blocks: Record<string, any>;
  blocks_layout: { items: string[] };
  title?: string;
  description?: string;
  preview_image?: string;
  subjects?: string[];
}> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const response = await fetch(buildApiUrl(path), {
    method: 'GET',
    headers: {
      ...buildHeaders(token),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!response.ok) throw new Error('Failed to fetch page content');
  const data = await response.json();

  const blocks = data.blocks || {};
  const blocksLayout = data.blocks_layout || { items: [] };

  const resolved = await resolveListingsInBlocks(blocks, blocksLayout.items, path, token);

  const previewImage = data.preview_image?.[0]?.['@id']
    || data.preview_image?.download
    || data.preview_image
    || '';

  return {
    blocks: resolved,
    blocks_layout: blocksLayout,
    title: data.title || '',
    description: data.description || '',
    preview_image: typeof previewImage === 'string' ? previewImage : '',
    subjects: data.subjects || [],
  };
};

export const fetchReferencePages = async (
  pageUrl: string,
  token?: string,
  maxSiblings: number = 5,
  maxChildren: number = 5,
): Promise<ReferencePage[]> => {
  const path = pageUrl.replace(/^https?:\/\/[^/]+/, '');
  const references: ReferencePage[] = [];
  const seen = new Set<string>();
  seen.add(path);

  const fetchPage = async (pagePath: string): Promise<ReferencePage | null> => {
    try {
      const response = await fetch(buildApiUrl(`${pagePath}?expand=breadcrumbs`), {
        method: 'GET',
        headers: {
          ...buildHeaders(token),
          Accept: 'application/json',
        },
        credentials: 'same-origin',
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.blocks || !data.blocks_layout) return null;
      const pageLinkPath = (data['@id'] || '').replace(/^https?:\/\/[^/]+/, '');
      const filteredBlocks: Record<string, any> = {};
      const filteredItems: string[] = [];
      for (const id of (data.blocks_layout.items || [])) {
        const block = data.blocks[id];
        if (block && !block.fixed) {
          filteredBlocks[id] = block;
          filteredItems.push(id);
        }
      }
      if (filteredItems.length === 0) return null;
      const page: ReferencePage = {
        link: pageLinkPath || pagePath,
        blocks: filteredBlocks,
        blocks_layout: { items: filteredItems },
      };
      if (data.title) page.title = data.title;
      if (data.description) page.description = data.description;
      if (typeof data.preview_image === 'string' && data.preview_image) page.preview_image = data.preview_image;
      if (data.subjects && data.subjects.length > 0) page.subjects = data.subjects;
      return page;
    } catch (_err) {
      return null;
    }
  };

  const parentPath = path.split('/').slice(0, -1).join('/') || '/';
  if (parentPath && parentPath !== '/' && !seen.has(parentPath)) {
    seen.add(parentPath);
    const parent = await fetchPage(parentPath);
    if (parent) references.push(parent);
  }

  try {
    const parentForNav = parentPath && parentPath !== '/' ? parentPath : path;
    const navResponse = await fetch(buildApiUrl(`${parentForNav}?expand=navigation&expand.navigation.depth=1`), {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });
    if (navResponse.ok) {
      const navData = await navResponse.json();
      const navItems = navData?.['@components']?.navigation?.items || navData?.items || [];
      let siblingCount = 0;
      for (const item of navItems) {
        if (siblingCount >= maxSiblings) break;
        const itemPath = (item['@id'] || item.url || '').replace(/^https?:\/\/[^/]+/, '');
        if (!itemPath || seen.has(itemPath)) continue;
        seen.add(itemPath);
        const sibling = await fetchPage(itemPath);
        if (sibling) {
          references.push(sibling);
          siblingCount++;
        }
      }
    }
  } catch (_err) {
    // Navigation fetch failed, continue without siblings
  }

  try {
    const childResponse = await fetch(buildApiUrl(`${path}?expand=navigation&expand.navigation.depth=1`), {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });
    if (childResponse.ok) {
      const childData = await childResponse.json();
      const childItems = childData?.['@components']?.navigation?.items || childData?.items || [];
      let childCount = 0;
      for (const item of childItems) {
        if (childCount >= maxChildren) break;
        const itemPath = (item['@id'] || item.url || '').replace(/^https?:\/\/[^/]+/, '');
        if (!itemPath || seen.has(itemPath)) continue;
        seen.add(itemPath);
        const child = await fetchPage(itemPath);
        if (child) {
          references.push(child);
          childCount++;
        }
      }
    }
  } catch (_err) {
    // Children fetch failed, continue without
  }

  return references;
};

export const createLayoutConversation = async (
  _baseUrl: string,
  payload: { schema: string; version: string; state: Record<string, any>; permissions?: string[]; language?: string; reference_pages?: ReferencePage[] },
  token?: string,
): Promise<{ conversation_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-conversations'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create layout conversation');
  }

  return response.json();
};

export const sendLayoutMessage = async (
  _baseUrl: string,
  conversationId: string,
  payload: { message: string; state?: Record<string, any>; context?: { text?: string; block_id?: string } },
  token?: string,
): Promise<{ job_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-messages'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ ...payload, conversation_id: conversationId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to send layout message');
  }

  return response.json();
};

export const pollLayoutJob = async (
  _baseUrl: string,
  jobId: string,
  token?: string,
): Promise<LayoutJobStatus> => {
  const response = await fetch(
    buildApiUrl(`/@ai-edit-jobs?job_id=${encodeURIComponent(jobId)}`),
    {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to poll layout job');
  }

  return response.json();
};

export const cancelLayoutJob = async (
  _baseUrl: string,
  jobId: string,
  token?: string,
): Promise<{ status: string }> => {
  const response = await fetch(buildApiUrl('/@ai-edit-job-cancel'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to cancel layout job');
  }

  return response.json();
};

export const createChatConversation = async (
  payload: { schema: string; version: string; state: Record<string, any>; language?: string },
  token?: string,
): Promise<{ conversation_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-chat-conversations'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create chat conversation');
  }

  return response.json();
};

export const sendChatMessage = async (
  conversationId: string,
  payload: { message: string; state?: Record<string, any>; context?: { text?: string; block_id?: string } },
  token?: string,
): Promise<{ job_id: string }> => {
  const response = await fetch(buildApiUrl('/@ai-chat-messages'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ ...payload, conversation_id: conversationId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to send chat message');
  }

  return response.json();
};

export const pollChatJob = async (
  jobId: string,
  token?: string,
): Promise<LayoutJobStatus> => {
  const response = await fetch(
    buildApiUrl(`/@ai-chat-jobs?job_id=${encodeURIComponent(jobId)}`),
    {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to poll chat job');
  }

  return response.json();
};

export const cancelChatJob = async (
  jobId: string,
  token?: string,
): Promise<{ status: string }> => {
  const response = await fetch(buildApiUrl('/@ai-chat-job-cancel'), {
    method: 'POST',
    headers: buildHeaders(token),
    credentials: 'same-origin',
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to cancel chat job');
  }

  return response.json();
};

export const getEditMessages = async (
  conversationId: string,
  after?: string,
  token?: string,
): Promise<AgentMessage[]> => {
  let url = `/@ai-edit-messages?conversation_id=${encodeURIComponent(conversationId)}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;
  const response = await fetch(buildApiUrl(url), {
    method: 'GET',
    headers: { ...buildHeaders(token), Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(await response.text() || 'Failed to get messages');
  return response.json();
};

export const getChatMessages = async (
  conversationId: string,
  after?: string,
  token?: string,
): Promise<AgentMessage[]> => {
  let url = `/@ai-chat-messages?conversation_id=${encodeURIComponent(conversationId)}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;
  const response = await fetch(buildApiUrl(url), {
    method: 'GET',
    headers: { ...buildHeaders(token), Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(await response.text() || 'Failed to get messages');
  return response.json();
};

export const getEditSkills = async (token?: string): Promise<SkillInfo[]> => {
  const response = await fetch(buildApiUrl('/@ai-edit-skills'), {
    method: 'GET',
    headers: { ...buildHeaders(token), Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.skills || [];
};
