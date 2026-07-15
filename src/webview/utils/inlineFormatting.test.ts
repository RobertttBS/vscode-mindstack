import { describe, it, expect } from 'vitest';
import { toggleBold, wrapSelection, autoPair, autoPairBackspace, WRAP_PAIRS } from './inlineFormatting';

describe('toggleBold', () => {
    it('wraps a selection in ** and keeps the inner text selected', () => {
        const r = toggleBold('hello world', 6, 11);
        expect(r.value).toBe('hello **world**');
        expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('world');
    });

    it('inserts empty markers and parks the caret between them', () => {
        const r = toggleBold('hello ', 6, 6);
        expect(r.value).toBe('hello ****');
        expect(r.selectionStart).toBe(8);
        expect(r.selectionEnd).toBe(8);
    });

    it('unwraps when the markers are inside the selection', () => {
        const r = toggleBold('hello **world**', 6, 15);
        expect(r.value).toBe('hello world');
        expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('world');
    });

    it('unwraps when the markers sit just outside the selection', () => {
        const r = toggleBold('hello **world**', 8, 13);
        expect(r.value).toBe('hello world');
        expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('world');
    });
});

describe('wrapSelection', () => {
    it('wraps a selection in a symmetric marker and keeps the inner text selected', () => {
        const r = wrapSelection('hello world', 6, 11, '`', '`');
        expect(r.value).toBe('hello `world`');
        expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('world');
    });

    it('wraps with a bracket pair', () => {
        const r = wrapSelection('see foo here', 4, 7, '(', ')');
        expect(r.value).toBe('see (foo) here');
        expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('foo');
    });

    it('stacks when applied repeatedly because the inner text stays selected', () => {
        const once = wrapSelection('a x b', 2, 3, '*', '*');
        expect(once.value).toBe('a *x* b');
        const twice = wrapSelection(once.value, once.selectionStart, once.selectionEnd, '*', '*');
        expect(twice.value).toBe('a **x** b');
        expect(twice.value.slice(twice.selectionStart, twice.selectionEnd)).toBe('x');
        const thrice = wrapSelection(twice.value, twice.selectionStart, twice.selectionEnd, '`', '`');
        expect(thrice.value).toBe('a **`x`** b');
    });

    it('exposes the expected wrap pairs', () => {
        expect(WRAP_PAIRS['*']).toBe('*');
        expect(WRAP_PAIRS['`']).toBe('`');
        expect(WRAP_PAIRS['(']).toBe(')');
        expect(WRAP_PAIRS['[']).toBe(']');
        expect(WRAP_PAIRS['{']).toBe('}');
        expect(WRAP_PAIRS['"']).toBe('"');
    });
});

// Helper: place the caret with a `|` marker, run the op, and render the result
// back with `|` so expectations read like what the user would see.
function withCaret(text: string) {
    const pos = text.indexOf('|');
    return { value: text.slice(0, pos) + text.slice(pos + 1), pos };
}

function type(text: string, key: string) {
    const { value, pos } = withCaret(text);
    const r = autoPair(value, pos, key);
    return r === null ? null : r.value.slice(0, r.selectionStart) + '|' + r.value.slice(r.selectionStart);
}

function backspace(text: string) {
    const { value, pos } = withCaret(text);
    const r = autoPairBackspace(value, pos);
    return r === null ? null : r.value.slice(0, r.selectionStart) + '|' + r.value.slice(r.selectionStart);
}

describe('autoPair', () => {
    it('inserts a matching pair at end of text', () => {
        expect(type('|', '(')).toBe('(|)');
        expect(type('foo |', '[')).toBe('foo [|]');
        expect(type('foo |', '`')).toBe('foo `|`');
        expect(type('foo |', '"')).toBe('foo "|"');
    });

    it('inserts a pair before whitespace and punctuation', () => {
        expect(type('a | b', '(')).toBe('a (|) b');
        expect(type('word|, rest', '(')).toBe('word(|), rest');
        expect(type('詞|，其餘', '(')).toBe('詞(|)，其餘');
    });

    it('pairs brackets right after a word (function call style)', () => {
        expect(type('foo|', '(')).toBe('foo(|)');
        expect(type('arr|', '[')).toBe('arr[|]');
    });

    it('does not pair directly before a word', () => {
        expect(type('|word', '(')).toBe(null);
        expect(type('|word', '*')).toBe(null);
    });

    it('does not pair symmetric markers or quotes right after a word', () => {
        expect(type("don|t", "'")).toBe(null);   // apostrophe
        expect(type('snake|case', '_')).toBe(null);
        expect(type('a|b', '*')).toBe(null);     // multiplication
        expect(type('code|', '`')).toBe(null);
    });

    it('stacks symmetric markers between an empty pair', () => {
        expect(type('*|*', '*')).toBe('**|**');
        expect(type('**|**', '*')).toBe('***|***');
        expect(type('`|`', '`')).toBe('``|``');
    });

    it('skips over a closing bracket already at the caret', () => {
        expect(type('(foo|)', ')')).toBe('(foo)|');
        expect(type('[foo|]', ']')).toBe('[foo]|');
        expect(type('{foo|}', '}')).toBe('{foo}|');
    });

    it('skips over a closing quote already at the caret', () => {
        expect(type('"foo|"', '"')).toBe('"foo"|');
        expect(type("'foo|'", "'")).toBe("'foo'|");
    });

    it('skips a symmetric marker that closes a word instead of stacking', () => {
        expect(type('*foo|*', '*')).toBe('*foo*|');
        expect(type('`foo|`', '`')).toBe('`foo`|');
    });

    it('allows nesting a different pair inside an existing one', () => {
        expect(type('(|)', '[')).toBe('([|])');
        expect(type('[|]', '(')).toBe('[(|)]');
    });

    it('ignores keys that are not pair characters', () => {
        expect(type('foo |', 'a')).toBe(null);
        expect(type('foo |', 'Enter')).toBe(null);
        expect(type('foo |', 'Backspace')).toBe(null);
    });

    it('does not skip a lone closing bracket with nothing at the caret', () => {
        expect(type('foo|bar', ')')).toBe(null);
    });
});

describe('autoPairBackspace', () => {
    it('removes both characters of an empty pair', () => {
        expect(backspace('(|)')).toBe('|');
        expect(backspace('a [|] b')).toBe('a | b');
        expect(backspace('*|*')).toBe('|');
        expect(backspace('"|"')).toBe('|');
    });

    it('falls through when the surrounding chars are not a pair', () => {
        expect(backspace('(|x')).toBe(null);
        expect(backspace('(a|)')).toBe(null);
        expect(backspace('ab|')).toBe(null);
        expect(backspace('|')).toBe(null);
    });
});
