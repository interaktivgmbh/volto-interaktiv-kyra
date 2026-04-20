/**
 * Shared highlight utilities — used by both the AIAssistant (Slate button)
 * and the Chat widget to apply word-level highlights across all Slate editors.
 */
import { Text, Editor } from 'slate';

export const HIGHLIGHT_COLORS = [
  '#fde68a',
  '#bbf7d0',
  '#bfdbfe',
  '#fecaca',
  '#e9d5ff',
  '#fed7aa',
];

// ── Global state (module-level singletons) ──────────────────────────
let globalHighlightWords: string[] = [];
let globalHighlightColor = '#fde68a';
let globalHighlightEditor: any = null;

export const getHighlightState = () => ({
  words: globalHighlightWords,
  color: globalHighlightColor,
  editor: globalHighlightEditor,
});

// ── Parse AI response into word list ────────────────────────────────
const MARKERS = [
  'Relevant Context:',
  'Füllwörter:',
  'Filler words:',
  'Markierte Wörter:',
  'Ergebnis:',
  'Gefundene Wörter:',
  'Wörter:',
  'Highlights:',
  'Markierungen:',
];

export const parseHighlightWords = (text: string): string[] => {
  if (!text) return [];
  let body = text;
  for (const marker of MARKERS) {
    const idx = body.indexOf(marker);
    if (idx !== -1) {
      body = body.substring(idx + marker.length);
      break;
    }
  }
  const lines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const words: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(/[,;]+/)
      .map((w) =>
        w
          .replace(/^[-•*\d.)\s"„"»«]+/, '')
          .replace(/["„"»«]+$/, '')
          .trim(),
      );
    for (const p of parts) {
      if (p.length >= 2 && p.length <= 40 && p.split(/\s+/).length <= 3) {
        words.push(p);
      }
    }
  }
  return [...new Set(words)];
};

// ── Detect highlight intent in user message ─────────────────────────
const HIGHLIGHT_PATTERNS_DE = [
  /markier/i,
  /hervorheb/i,
  /highlight/i,
  /füllwört/i,
  /farbig.*wört/i,
  /wört.*farbig/i,
  /wört.*markier/i,
  /kennzeichn.*wört/i,
];

const HIGHLIGHT_PATTERNS_EN = [
  /highlight/i,
  /mark\s+(the\s+)?words/i,
  /filler\s+words/i,
  /emphasize/i,
];

export const detectHighlightIntent = (message: string): boolean => {
  const patterns = [...HIGHLIGHT_PATTERNS_DE, ...HIGHLIGHT_PATTERNS_EN];
  return patterns.some((p) => p.test(message));
};

// ── DOM-based highlighting (works immediately, no React re-render) ──

/**
 * Walk text nodes inside a container and build DOM Range objects
 * for every occurrence of the given words.
 */
const _findDomRanges = (
  container: Element,
  words: string[],
): Range[] => {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    const lower = text.toLowerCase();
    for (const word of words) {
      const wLower = word.toLowerCase();
      let idx = 0;
      while (idx < lower.length) {
        const found = lower.indexOf(wLower, idx);
        if (found === -1) break;
        const range = document.createRange();
        range.setStart(node, found);
        range.setEnd(node, found + word.length);
        ranges.push(range);
        idx = found + word.length;
      }
    }
  }
  return ranges;
};

/**
 * Apply DOM-based highlights using the CSS Custom Highlight API.
 * Falls back to injecting <mark> wrappers if the API is unavailable.
 */
const _applyDomHighlights = (words: string[]): number => {
  if (typeof window === 'undefined') return 0;

  // Find all Slate editor containers in the page
  const editors = document.querySelectorAll(
    '#page-edit [data-slate-editor], #page-document [data-slate-editor], .block-editor-slate [data-slate-editor]',
  );
  if (editors.length === 0) return 0;

  const allRanges: Range[] = [];
  for (const editor of editors) {
    allRanges.push(..._findDomRanges(editor, words));
  }

  if (allRanges.length === 0) return 0;

  // Use CSS Custom Highlight API if available
  if ('Highlight' in window && CSS?.highlights) {
    try {
      const highlight = new (window as any).Highlight(...allRanges);
      (CSS as any).highlights.set('kyra-highlight', highlight);
      return allRanges.length;
    } catch (_e) {
      // fallback below
    }
  }

  // Fallback: wrap matches in <mark> elements
  // Process ranges in reverse to preserve offsets
  for (let i = allRanges.length - 1; i >= 0; i--) {
    try {
      const mark = document.createElement('mark');
      mark.className = 'kyra-dom-highlight';
      mark.style.backgroundColor = globalHighlightColor;
      mark.style.borderRadius = '2px';
      mark.style.padding = '0 1px';
      allRanges[i].surroundContents(mark);
    } catch (_e) {
      // surroundContents fails if range spans multiple nodes
    }
  }
  return allRanges.length;
};

const _clearDomHighlights = () => {
  if (typeof window === 'undefined') return;

  // Clear CSS Custom Highlight API
  if (CSS?.highlights) {
    try {
      (CSS as any).highlights.delete('kyra-highlight');
    } catch (_e) {}
  }

  // Clear fallback <mark> elements
  const marks = document.querySelectorAll('mark.kyra-dom-highlight');
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  }
};

// ── Apply / clear highlights ────────────────────────────────────────

/**
 * Apply highlights to a specific Slate editor (or all editors on page).
 * Returns the number of matches found.
 */
export const applyHighlightsGlobal = (
  words: string[],
  color?: string,
  editor?: any,
): number => {
  globalHighlightWords = words;
  globalHighlightColor = color || HIGHLIGHT_COLORS[Math.floor(Math.random() * HIGHLIGHT_COLORS.length)];
  globalHighlightEditor = editor || null;

  if (editor) {
    // Specific editor (AIAssistant Slate button path)
    let matches = 0;
    try {
      const fullText = Editor.string(editor, []).toLowerCase();
      for (const w of words) {
        const wl = w.toLowerCase();
        let idx = 0;
        while (idx < fullText.length) {
          const found = fullText.indexOf(wl, idx);
          if (found === -1) break;
          matches++;
          idx = found + wl.length;
        }
      }
      editor.onChange();
    } catch (_e) {
      // editor might not be mounted
    }
    return matches;
  }

  // No specific editor → apply via DOM for immediate effect
  // Small delay to ensure DOM is ready after any state updates
  setTimeout(() => {
    _applyDomHighlights(words);
  }, 100);

  return words.length; // estimate
};

export const clearHighlightsGlobal = () => {
  globalHighlightWords = [];
  globalHighlightEditor = null;
  _clearDomHighlights();
};

// ── Slate runtime decorator ─────────────────────────────────────────
export const kyraHighlightDecorate = (
  editor: any,
  [node, path]: [any, number[]],
  acc: any[] = [],
): any[] => {
  if (!Text.isText(node) || globalHighlightWords.length === 0) return acc;
  if (globalHighlightEditor && editor !== globalHighlightEditor) return acc;

  const { text } = node as { text: string };
  const lower = text.toLowerCase();
  const ranges = [...acc];

  for (const word of globalHighlightWords) {
    const wLower = word.toLowerCase();
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(wLower, idx);
      if (found === -1) break;
      ranges.push({
        anchor: { path, offset: found },
        focus: { path, offset: found + word.length },
        kyraHighlight: true,
        kyraHighlightColor: globalHighlightColor,
      });
      idx = found + word.length;
    }
  }
  return ranges;
};
