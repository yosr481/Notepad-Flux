import { describe, it, expect } from 'vitest';
import { scanCallout, calloutTitle, CALLOUT_TYPES } from '../calloutSyntax';

// Spec: Docs/internal/callouts-spec.md ("Syntax", types table, "Modules and public API").
// Input is the blockquote's first line AFTER the quote marker(s) and one optional space.
// Pinned choices where the spec is silent:
//  - markEnd = index just after `]` (or just after the fold char); computed here with indexOf.
//  - title = text after the marker with leading AND trailing whitespace trimmed; '' if none.
//    No space is required before the title: `[!note]x` -> title 'x'.
//  - fold is recognised only directly after `]`: `[!note] -` is fold '' with title '-'.
//  - Not handled on purpose: leading spaces (caller strips exactly marker + one space), escapes, code.
//  - scanCallout does NOT default the title; calloutTitle does.

const CANON = {
    note: 'pencil', abstract: 'clipboard-list', info: 'info', todo: 'circle-check', tip: 'flame',
    important: 'circle-alert', success: 'check', question: 'circle-help', warning: 'triangle-alert',
    caution: 'octagon-alert', failure: 'x', danger: 'zap', bug: 'bug', example: 'list', quote: 'quote',
};
const ALIASES = {
    summary: 'abstract', tldr: 'abstract', hint: 'tip', check: 'success', done: 'success',
    help: 'question', faq: 'question', attention: 'warning', fail: 'failure', missing: 'failure',
    error: 'danger', cite: 'quote',
};

describe('scanCallout: basic shape', () => {
    it('[!note] -> type, canonical, no fold, no title, markEnd after ]', () => {
        const t = '[!note]';
        expect(scanCallout(t)).toEqual({
            type: 'note', canonical: 'note', fold: '', title: '', markEnd: t.indexOf(']') + 1,
        });
    });

    it('title after one space; markEnd is just after ] (before the space)', () => {
        const t = '[!tip] Remember this';
        const s = scanCallout(t);
        expect(s.title).toBe('Remember this');
        expect(s.markEnd).toBe(t.indexOf(']') + 1);
        expect(t.slice(s.markEnd)).toBe(' Remember this');
    });

    it('GitHub style [!NOTE]: type keeps case, canonical lowercased', () => {
        const s = scanCallout('[!NOTE]');
        expect(s.type).toBe('NOTE');
        expect(s.canonical).toBe('note');
    });

    it('mixed case type kept as written', () => {
        const s = scanCallout('[!WaRnInG]');
        expect(s.type).toBe('WaRnInG');
        expect(s.canonical).toBe('warning');
    });

    it('scan does not default an empty title (calloutTitle does)', () => {
        expect(scanCallout('[!faq]').title).toBe('');
    });
});

describe('scanCallout: fold', () => {
    it('[!note]- folded by default, no title', () => {
        const t = '[!note]-';
        expect(scanCallout(t)).toEqual({
            type: 'note', canonical: 'note', fold: '-', title: '', markEnd: t.indexOf('-') + 1,
        });
    });

    it('[!note]+ Open -> fold +, title Open, markEnd after the +', () => {
        const t = '[!note]+ Open';
        const s = scanCallout(t);
        expect(s.fold).toBe('+');
        expect(s.title).toBe('Open');
        expect(s.markEnd).toBe(t.indexOf('+') + 1);
    });

    it('[!tip]- Title -> fold -, title Title', () => {
        const t = '[!tip]- Title';
        const s = scanCallout(t);
        expect(s.fold).toBe('-');
        expect(s.title).toBe('Title');
        expect(s.markEnd).toBe(t.indexOf('-') + 1);
    });

    it('fold must be directly after ]: "[!note] -" is no fold, title "-"', () => {
        const s = scanCallout('[!note] -');
        expect(s.fold).toBe('');
        expect(s.title).toBe('-');
    });

    it('only one fold char: "[!note]--" -> fold -, title -', () => {
        const s = scanCallout('[!note]--');
        expect(s.fold).toBe('-');
        expect(s.title).toBe('-');
    });

    it('no fold char and no space: fold is empty string, not undefined', () => {
        expect(scanCallout('[!note] x').fold).toBe('');
    });
});

describe('scanCallout: title', () => {
    it('no space before title: [!note]x -> title x', () => {
        const t = '[!note]x';
        const s = scanCallout(t);
        expect(s.title).toBe('x');
        expect(s.markEnd).toBe(t.indexOf(']') + 1);
    });

    it('Hebrew title', () => {
        const s = scanCallout('[!note] כותרת');
        expect(s.title).toBe('כותרת');
        expect(s.type).toBe('note');
    });

    it('inline markdown in the title is kept raw', () => {
        expect(scanCallout('[!tip] **bold** x').title).toBe('**bold** x');
        expect(scanCallout('[!tip] `code` and [l](u)').title).toBe('`code` and [l](u)');
    });

    it('title is trimmed on both ends', () => {
        expect(scanCallout('[!note]   spaced out   ').title).toBe('spaced out');
    });

    it('whitespace-only after marker -> empty title', () => {
        expect(scanCallout('[!note]   ').title).toBe('');
        expect(scanCallout('[!note]-  ').title).toBe('');
    });

    it('inner spaces of the title are preserved', () => {
        expect(scanCallout('[!note] a  b').title).toBe('a  b');
    });

    it('a second [!x] in the title is just title text', () => {
        expect(scanCallout('[!note] see [!tip]').title).toBe('see [!tip]');
    });
});

describe('scanCallout: type characters and length', () => {
    it('digits, underscore, dash allowed', () => {
        expect(scanCallout('[!a1_b-c]').type).toBe('a1_b-c');
        expect(scanCallout('[!123]').type).toBe('123');
        expect(scanCallout('[!_]').type).toBe('_');
        expect(scanCallout('[!-]').type).toBe('-');
    });

    it('a dash inside the type is part of the type, not a fold', () => {
        const s = scanCallout('[!my-type]-');
        expect(s.type).toBe('my-type');
        expect(s.fold).toBe('-');
    });

    it('exactly 50 chars is allowed', () => {
        const type = 'a'.repeat(50);
        const s = scanCallout(`[!${type}]`);
        expect(s.type).toBe(type);
        expect(s.markEnd).toBe(`[!${type}]`.length);
    });

    it('51 chars -> null', () => {
        expect(scanCallout(`[!${'a'.repeat(51)}]`)).toBeNull();
    });

    it('single char type ok', () => {
        expect(scanCallout('[!x]').type).toBe('x');
    });
});

describe('scanCallout: null cases', () => {
    it.each([
        ['empty string', ''],
        ['plain text', 'hello'],
        ['no [! at start', '[note]'],
        ['[! not at index 0', 'text [!note]'],
        ['empty type', '[!]'],
        ['empty type with title', '[!] Title'],
        ['space in type', '[!a b]'],
        ['leading space in type', '[! note]'],
        ['illegal char', '[!no.te]'],
        ['plus inside type', '[!note+]'],
        ['non-ascii type', '[!é]'],
        ['hebrew type', '[!הערה]'],
        ['missing ]', '[!note'],
        ['missing ] with title', '[!note Title'],
        ['escaped', '\\[!note]'],
        ['one leading space', ' [!note]'],
        ['two leading spaces', '  [!note]'],
        ['tab first', '\t[!note]'],
        ['footnote ref', '[^1]'],
        ['task box', '[ ] todo'],
        ['link', '[text](u)'],
    ])('%s -> null', (_name, input) => {
        expect(scanCallout(input)).toBeNull();
    });
});

describe('scanCallout: canonical resolution', () => {
    it.each(Object.keys(CANON))('canonical %s maps to itself', (c) => {
        expect(scanCallout(`[!${c}]`).canonical).toBe(c);
    });

    it.each(Object.entries(ALIASES))('alias %s -> %s', (alias, canon) => {
        const s = scanCallout(`[!${alias}]`);
        expect(s.type).toBe(alias);
        expect(s.canonical).toBe(canon);
    });

    it('aliases are case-insensitive', () => {
        expect(scanCallout('[!TLDR]').canonical).toBe('abstract');
        expect(scanCallout('[!Hint]').canonical).toBe('tip');
        expect(scanCallout('[!ERROR]').canonical).toBe('danger');
    });

    it('important and caution are their own canonicals (not warning)', () => {
        expect(scanCallout('[!important]').canonical).toBe('important');
        expect(scanCallout('[!caution]').canonical).toBe('caution');
    });

    it.each(['custom', 'my_type', '123', 'noted', 'notes', 'a-b'])('unknown type %s -> note', (t) => {
        const s = scanCallout(`[!${t}]`);
        expect(s.type).toBe(t);
        expect(s.canonical).toBe('note');
    });

    it('no prefix matching: "tipx" and "xtip" are unknown', () => {
        expect(scanCallout('[!tipx]').canonical).toBe('note');
        expect(scanCallout('[!xtip]').canonical).toBe('note');
    });
});

describe('calloutTitle', () => {
    it('uses scan.title when non-empty (kept raw, not re-cased)', () => {
        expect(calloutTitle(scanCallout('[!tip] my **title**'))).toBe('my **title**');
    });

    it('default: type first letter uppercased', () => {
        expect(calloutTitle(scanCallout('[!faq]'))).toBe('Faq');
        expect(calloutTitle(scanCallout('[!todo]'))).toBe('Todo');
        expect(calloutTitle(scanCallout('[!note]'))).toBe('Note');
    });

    it('default: rest lowercased (WARNING -> Warning)', () => {
        expect(calloutTitle(scanCallout('[!WARNING]'))).toBe('Warning');
        expect(calloutTitle(scanCallout('[!nOTE]'))).toBe('Note');
    });

    it('default uses the type as written, not the canonical (alias / unknown)', () => {
        expect(calloutTitle(scanCallout('[!tldr]'))).toBe('Tldr');
        expect(calloutTitle(scanCallout('[!my_type]'))).toBe('My_type');
        expect(calloutTitle(scanCallout('[!1abc]'))).toBe('1abc');
    });

    it('fold marker does not affect the default title', () => {
        expect(calloutTitle(scanCallout('[!tip]-'))).toBe('Tip');
        expect(calloutTitle(scanCallout('[!tip]+'))).toBe('Tip');
    });

    it('whitespace-only title falls back to the default', () => {
        expect(calloutTitle(scanCallout('[!info]   '))).toBe('Info');
    });

    it('Hebrew title passes through', () => {
        expect(calloutTitle(scanCallout('[!note] כותרת'))).toBe('כותרת');
    });
});

describe('CALLOUT_TYPES', () => {
    it('has exactly the 15 canonical keys', () => {
        expect(Object.keys(CALLOUT_TYPES).sort()).toEqual(Object.keys(CANON).sort());
    });

    it.each(Object.entries(CANON))('%s icon is %s', (c, icon) => {
        expect(CALLOUT_TYPES[c].icon).toBe(icon);
    });

    it('aliases are not keys', () => {
        for (const a of Object.keys(ALIASES)) expect(CALLOUT_TYPES).not.toHaveProperty(a);
    });

    it('every scanned canonical is a key of the table', () => {
        for (const t of [...Object.keys(CANON), ...Object.keys(ALIASES), 'zzz']) {
            expect(CALLOUT_TYPES).toHaveProperty(scanCallout(`[!${t}]`).canonical);
        }
    });
});

describe('scanCallout: prototype-key safety', () => {
    it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])('[!%s] is an unknown type -> note', (k) => {
        const s = scanCallout(`[!${k}]`);
        expect(s.type).toBe(k);
        expect(s.canonical).toBe('note');
        expect(Object.hasOwn(CALLOUT_TYPES, s.canonical)).toBe(true);
    });
});
