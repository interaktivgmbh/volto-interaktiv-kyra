const IMAGE_REF_FIELDS = ['preview_image', 'image', 'href', 'buttonLink'];

type ImageRef = { '@id': string; image_scales?: any; [key: string]: any };

const isIncompleteImageRef = (value: any): value is ImageRef[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  const first = value[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    typeof first['@id'] === 'string' &&
    !first['image_scales'] &&
    !first['image_field']
  );
};

const isIncompleteUrlField = (block: Record<string, any>): boolean => {
  if (typeof block.url !== 'string' || block.url.length === 0) return false;
  if (block['@type'] !== 'highlight' && block['@type'] !== 'image') return false;
  if (!block.image_scales) return true;
  const scales = block.image_scales;
  const firstKey = Object.keys(scales)[0];
  if (!firstKey || !Array.isArray(scales[firstKey]) || !scales[firstKey][0]) return true;
  const download = scales[firstKey][0].download || '';
  const urlPath = block.url.replace(/^https?:\/\/[^/]+/, '');
  return !download.includes(urlPath.split('/').pop()?.split('.')[0] || '___');
};

const fetchImageData = async (
  imageId: string,
  token?: string,
): Promise<Record<string, any> | null> => {
  const clean = imageId.replace(/^https?:\/\/[^/]+/, '');
  const url = `/++api++${clean.startsWith('/') ? clean : `/${clean}`}`;
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(url, { headers, credentials: 'same-origin' });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
};

const buildImageScales = (imageId: string, data: Record<string, any>): Record<string, any> | null => {
  if (data.image_scales) return { image_scales: data.image_scales, image_field: data.image_field || 'image' };

  const img = data.image;
  if (!img || typeof img !== 'object' || !img.download) return null;

  const basePath = imageId.replace(/^https?:\/\/[^/]+/, '');
  return {
    image_field: 'image',
    image_scales: {
      image: [{
        'content-type': img['content-type'],
        download: `${basePath}/@@images/image`,
        filename: img.filename,
        height: img.height,
        width: img.width,
        scales: img.scales || {},
      }],
    },
  };
};

const enrichRef = (ref: ImageRef, data: Record<string, any>): ImageRef => {
  const enriched = { ...ref };
  if (data['@type']) enriched['@type'] = data['@type'];
  if (data.title) enriched.title = data.title;
  if (data.description !== undefined) enriched.description = data.description;

  const scales = buildImageScales(ref['@id'] || '', data);
  if (scales) Object.assign(enriched, scales);

  return enriched;
};

const processBlock = async (
  block: Record<string, any>,
  token?: string,
): Promise<boolean> => {
  let changed = false;

  if (isIncompleteUrlField(block)) {
    const data = await fetchImageData(block.url, token);
    if (data) {
      const scales = buildImageScales(block.url, data);
      if (scales) {
        Object.assign(block, scales);
        changed = true;
      }
    }
  }

  for (const field of IMAGE_REF_FIELDS) {
    const value = block[field];
    if (isIncompleteImageRef(value)) {
      const id = value[0]['@id'];
      const data = await fetchImageData(id, token);
      if (data) {
        block[field] = [enrichRef(value[0], data)];
        changed = true;
      }
    }
  }

  const arrayFields = ['slides', 'columns'];
  for (const af of arrayFields) {
    if (Array.isArray(block[af])) {
      for (const item of block[af]) {
        if (typeof item === 'object' && item !== null) {
          const c = await processBlock(item, token);
          if (c) changed = true;
        }
      }
    }
  }

  if (block.data?.blocks) {
    for (const subBlock of Object.values(block.data.blocks)) {
      if (typeof subBlock === 'object' && subBlock !== null) {
        const c = await processBlock(subBlock as Record<string, any>, token);
        if (c) changed = true;
      }
    }
  }

  if (block.blocks && block['@type'] !== 'data') {
    for (const subBlock of Object.values(block.blocks)) {
      if (typeof subBlock === 'object' && subBlock !== null) {
        const c = await processBlock(subBlock as Record<string, any>, token);
        if (c) changed = true;
      }
    }
  }

  return changed;
};

export const resolveImageScales = async (
  state: Record<string, any>,
  token?: string,
): Promise<Record<string, any>> => {
  if (!state?.blocks) return state;

  const blocks = JSON.parse(JSON.stringify(state.blocks));
  let anyChanged = false;

  for (const [id, block] of Object.entries(blocks)) {
    if (typeof block !== 'object' || block === null) continue;
    const changed = await processBlock(block as Record<string, any>, token);
    if (changed) anyChanged = true;
  }

  return anyChanged ? { ...state, blocks } : state;
};
