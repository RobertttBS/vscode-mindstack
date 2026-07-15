// Pure helpers for toggling inline markdown formatting inside a plain
// <textarea>. Like the list helpers, they take the text plus the selection
// (start/end caret offsets) and return the next text and where the selection
// should land. Keeping them pure makes them easy to unit-test without a DOM.

import type { EditResult } from './listEditing';

const BOLD = '**';

/**
 * Toggle bold (`**`) around the current selection, mirroring Cmd/Ctrl+B in
 * editors like Obsidian:
 *
 * - Selection already wrapped (markers inside or just outside the selection):
 *   strip the markers, leaving the inner text selected.
 * - Selection without markers: wrap it in `**`, keeping the inner text selected.
 * - No selection: insert an empty `****` and drop the caret between the markers
 *   so the user can type bold text straight away.
 */
export function toggleBold(value: string, start: number, end: number): EditResult {
    const selected = value.slice(start, end);

    // Markers are part of the selection (e.g. user selected "**word**").
    if (selected.startsWith(BOLD) && selected.endsWith(BOLD) && selected.length >= BOLD.length * 2) {
        const inner = selected.slice(BOLD.length, -BOLD.length);
        const newValue = value.slice(0, start) + inner + value.slice(end);
        return { value: newValue, selectionStart: start, selectionEnd: start + inner.length };
    }

    // Markers sit just outside the selection (e.g. "word" selected within "**word**").
    if (value.slice(start - BOLD.length, start) === BOLD && value.slice(end, end + BOLD.length) === BOLD) {
        const newValue = value.slice(0, start - BOLD.length) + selected + value.slice(end + BOLD.length);
        return { value: newValue, selectionStart: start - BOLD.length, selectionEnd: end - BOLD.length };
    }

    // Otherwise wrap the selection (or insert empty markers when it's collapsed).
    const newValue = value.slice(0, start) + BOLD + selected + BOLD + value.slice(end);
    return { value: newValue, selectionStart: start + BOLD.length, selectionEnd: end + BOLD.length };
}

/**
 * Characters that, when typed over a non-empty selection, wrap the selection in
 * a matching pair instead of replacing it — mirroring Obsidian/typical editors.
 * Symmetric markers (`*`, `` ` ``, ...) map to themselves; brackets/quotes map to
 * their closing partner.
 */
export const WRAP_PAIRS: Record<string, string> = {
    '*': '*',
    '_': '_',
    '`': '`',
    '~': '~',
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
};

/**
 * Wrap the current selection with `open`/`close`, leaving the original (inner)
 * text selected. Because the inner text stays selected, pressing the same key
 * again stacks another layer — so `*` twice yields `**…**` (bold) and `` ` ``
 * three times yields ```` ```…``` ```` — matching how Obsidian wraps selections.
 */
export function wrapSelection(value: string, start: number, end: number, open: string, close: string): EditResult {
    const selected = value.slice(start, end);
    const newValue = value.slice(0, start) + open + selected + close + value.slice(end);
    return { value: newValue, selectionStart: start + open.length, selectionEnd: end + open.length };
}

/** Symmetric markdown markers: the same character opens and closes a span. */
const SYMMETRIC_MARKERS = new Set(['*', '_', '`', '~']);

/** Closing characters that always skip over an identical char at the caret. */
const SKIP_OVER = new Set([')', ']', '}', '"', "'"]);

/**
 * Keys that should NOT auto-pair right after a word character, so apostrophes
 * (don't), snake_case and `a*b` stay untouched. Brackets are exempt: `foo(`
 * should still pair.
 */
const NO_PAIR_AFTER_WORD = new Set(['*', '_', '`', '~', '"', "'"]);

/**
 * Auto-pairing only fires when the caret sits before one of these characters
 * (or whitespace / end of text) — mirroring VS Code's `autoCloseBefore`, so
 * typing `(` directly in front of a word inserts a lone `(` instead of
 * wrapping nothing.
 */
const CLOSE_BEFORE = ')]}`*_~"\'.,;:!?，。；：！？、）】」』';

const WORD_CHAR = /[A-Za-z0-9_]/;

/**
 * Auto-pair for an empty selection, mirroring Obsidian/VS Code:
 *
 * - Typing an opening character inserts the matching closing character and
 *   places the caret between them (`(` → `(|)`).
 * - Typing a closing bracket/quote that is already at the caret skips over it
 *   instead of inserting a duplicate (`(foo|)` + `)` → `(foo)|`).
 * - Symmetric markers skip only when they end a word (`*foo|*` + `*` →
 *   `*foo*|`); between an empty pair they stack (`*|*` + `*` → `**|**`), so
 *   double-tapping `*` still builds bold.
 *
 * Returns `null` when the key should fall through to the textarea's default.
 */
export function autoPair(value: string, pos: number, key: string): EditResult | null {
    const next = value[pos];
    const prev = value[pos - 1];
    const afterWord = prev !== undefined && WORD_CHAR.test(prev);

    if (next === key && (SKIP_OVER.has(key) || (SYMMETRIC_MARKERS.has(key) && afterWord))) {
        return { value, selectionStart: pos + 1, selectionEnd: pos + 1 };
    }

    const close = WRAP_PAIRS[key];
    if (!close) { return null; }
    if (next !== undefined && !/\s/.test(next) && !CLOSE_BEFORE.includes(next)) { return null; }
    if (afterWord && NO_PAIR_AFTER_WORD.has(key)) { return null; }

    const newValue = value.slice(0, pos) + key + close + value.slice(pos);
    return { value: newValue, selectionStart: pos + 1, selectionEnd: pos + 1 };
}

/**
 * Backspace between an empty pair removes both characters (`(|)` → empty),
 * completing the auto-pair round trip. Returns `null` when the characters
 * around the caret aren't a matching pair.
 */
export function autoPairBackspace(value: string, pos: number): EditResult | null {
    const prev = value[pos - 1];
    const close = prev !== undefined ? WRAP_PAIRS[prev] : undefined;
    if (close === undefined || value[pos] !== close) { return null; }
    const newValue = value.slice(0, pos - 1) + value.slice(pos + 1);
    return { value: newValue, selectionStart: pos - 1, selectionEnd: pos - 1 };
}
