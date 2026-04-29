export type LiveDiffMetadataField =
  | 'title'
  | 'description'
  | 'preview_image'
  | 'subjects';

export type LiveDiff = {
  added: string[];
  removed: string[];
  moved: string[];
  textChanged: string[];
  metadataChanged: LiveDiffMetadataField[];
};

export type FormStateLike = {
  blocks?: Record<string, any> | null;
  blocks_layout?: { items?: string[] } | null;
  title?: any;
  description?: any;
  preview_image?: any;
  subjects?: any;
};

const stableStringify = (value: any): string => {
  if (value === null || value === undefined) return JSON.stringify(value);
  const seen = new WeakSet<object>();
  const sort = (v: any): any => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return null;
      seen.add(v);
      if (Array.isArray(v)) return v.map(sort);
      const out: Record<string, any> = {};
      for (const k of Object.keys(v).sort()) {
        out[k] = sort(v[k]);
      }
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(sort(value));
  } catch {
    return '';
  }
};

const equalDeep = (a: any, b: any): boolean => {
  if (a === b) return true;
  return stableStringify(a) === stableStringify(b);
};

export const EMPTY_DIFF: LiveDiff = Object.freeze({
  added: [],
  removed: [],
  moved: [],
  textChanged: [],
  metadataChanged: [],
}) as LiveDiff;

export const diffIsEmpty = (diff: LiveDiff): boolean =>
  diff.added.length === 0 &&
  diff.removed.length === 0 &&
  diff.moved.length === 0 &&
  diff.textChanged.length === 0 &&
  diff.metadataChanged.length === 0;

export function diffFormState(
  prev: FormStateLike | null | undefined,
  next: FormStateLike | null | undefined,
): LiveDiff {
  const prevItems = prev?.blocks_layout?.items ?? [];
  const nextItems = next?.blocks_layout?.items ?? [];
  const prevSet = new Set(prevItems);
  const nextSet = new Set(nextItems);

  const added = nextItems.filter((id) => !prevSet.has(id));
  const removed = prevItems.filter((id) => !nextSet.has(id));

  const moved: string[] = [];
  const textChanged: string[] = [];

  const commonInPrevOrder = prevItems.filter((id) => nextSet.has(id));
  const commonInNextOrder = nextItems.filter((id) => prevSet.has(id));
  const indexInNext = new Map<string, number>();
  commonInNextOrder.forEach((id, i) => indexInNext.set(id, i));

  for (let i = 0; i < commonInPrevOrder.length; i++) {
    const id = commonInPrevOrder[i];
    if (indexInNext.get(id) !== i) moved.push(id);
  }

  for (const id of commonInNextOrder) {
    if (!equalDeep(prev?.blocks?.[id], next?.blocks?.[id])) {
      textChanged.push(id);
    }
  }

  const metadataChanged: LiveDiffMetadataField[] = [];
  const metaKeys: LiveDiffMetadataField[] = [
    'title',
    'description',
    'preview_image',
    'subjects',
  ];
  for (const k of metaKeys) {
    const a = (prev as any)?.[k];
    const b = (next as any)?.[k];
    if (a === undefined && b === undefined) continue;
    if (!equalDeep(a, b)) metadataChanged.push(k);
  }

  return { added, removed, moved, textChanged, metadataChanged };
}
