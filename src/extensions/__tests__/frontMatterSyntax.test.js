import { describe, it, expect } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';
import { footnoteSyntax } from '../footnoteSyntax';
import { frontMatterSyntax, scanFrontMatter, FRONT_MATTER_MAX_LINES } from '../frontMatterSyntax';

// Spec: Docs/internal/frontmatter-spec.md ("Syntax", "Editor").
// Pinned choices where the spec is silent:
//  - Scanner offsets are into the text as given (BOM counts as 1 char, so `from` is 1 after a BOM).
//  - CRLF: `to` and `contentTo` stop before the "\r" of their line; contentFrom is after "\n".
//    Trailing spaces/tabs on the closing fence line ARE inside `to` (to = end of the line text).
//  - Parser: FrontMatterMark spans the whole fence line text (indent-free, trailing blanks included,
//    newline excluded). FrontMatterContent spans contentFrom..contentTo, absent when they are equal.
//    FrontMatter spans scan.from..scan.to; its direct children are only these marks and the content.
//  - Front matter is a top-level, line-0 construct: never inside a blockquote or list item.
//  - Nothing else (HR, setext, heading, list, paragraph...) is produced inside the front matter range.

const ext = [mathSyntax, footnoteSyntax, frontMatterSyntax];
const parser = markdown({ base: markdownLanguage, extensions: ext }).language.parser;
const baseParser = markdown({ base: markdownLanguage, extensions: [mathSyntax, footnoteSyntax] }).language.parser;
const soloParser = markdown({ base: markdownLanguage, extensions: [frontMatterSyntax] }).language.parser;

const nodes = (doc, p = parser) => {
    const out = [];
    p.parse(doc).iterate({
        enter: (n) => { out.push({ name: n.name, from: n.from, to: n.to, parent: n.node.parent && n.node.parent.name }); },
    });
    return out;
};
const named = (doc, name, p = parser) => nodes(doc, p).filter((n) => n.name === name);
const spans = (doc, name, p = parser) => named(doc, name, p).map((n) => [n.from, n.to]);
const shape = (doc, p) => nodes(doc, p).map((n) => `${n.name}:${n.from}-${n.to}`);

describe('scanFrontMatter: basic', () => {
    it('scans a simple block with exact offsets', () => {
        const doc = '---\ntitle: x\n---\nbody';
        const close = doc.lastIndexOf('---');
        expect(scanFrontMatter(doc)).toEqual({
            from: 0, to: close + 3, contentFrom: doc.indexOf('title'), contentTo: doc.indexOf('\n---', 3),
        });
    });

    it('content slice is exactly the YAML between the fences', () => {
        const doc = '---\na: 1\nb: 2\n---\n';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\nb: 2');
    });

    it('`to` excludes the newline after the closing fence', () => {
        const doc = '---\na: 1\n---\nbody';
        expect(scanFrontMatter(doc).to).toBe(doc.indexOf('\nbody'));
    });

    it('closing fence at end of text, no trailing newline', () => {
        const doc = '---\na: 1\n---';
        expect(scanFrontMatter(doc).to).toBe(doc.length);
    });

    it('closing fence followed by a trailing newline only', () => {
        const doc = '---\na: 1\n---\n';
        expect(scanFrontMatter(doc).to).toBe(doc.length - 1);
    });

    it('closing fence immediately followed by document content is fine', () => {
        const doc = '---\na: 1\n---\n# Heading\ntext';
        const r = scanFrontMatter(doc);
        expect(r).not.toBeNull();
        expect(doc.slice(r.to)).toBe('\n# Heading\ntext');
    });

    it('multi-line YAML with blank lines inside', () => {
        const doc = '---\na: 1\n\nb:\n  - x\n  - y\n---\nz';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\n\nb:\n  - x\n  - y');
    });

    it('is pure: same input, same output; input not mutated', () => {
        const doc = '---\na: 1\n---\n';
        expect(scanFrontMatter(doc)).toEqual(scanFrontMatter(doc));
        expect(doc).toBe('---\na: 1\n---\n');
    });
});

describe('scanFrontMatter: empty front matter', () => {
    it('---\\n--- : contentFrom === contentTo, directly after the opening newline', () => {
        const doc = '---\n---';
        const r = scanFrontMatter(doc);
        expect(r).toEqual({ from: 0, to: doc.length, contentFrom: doc.indexOf('\n') + 1, contentTo: doc.indexOf('\n') + 1 });
        expect(r.contentFrom).toBe(r.contentTo);
    });

    it('empty with trailing text', () => {
        const doc = '---\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(r.to).toBe(doc.indexOf('\nbody'));
        expect(r.contentFrom).toBe(r.contentTo);
    });

    it('empty closed by "..."', () => {
        const doc = '---\n...\n';
        const r = scanFrontMatter(doc);
        expect(r.to).toBe(doc.indexOf('\n', 4));
        expect(r.contentFrom).toBe(r.contentTo);
    });
});

describe('scanFrontMatter: fences', () => {
    it('"..." closes the block', () => {
        const doc = '---\na: 1\n...\nbody';
        const r = scanFrontMatter(doc);
        expect(r.to).toBe(doc.indexOf('\nbody'));
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1');
    });

    it('trailing spaces/tabs allowed on the opening fence', () => {
        const doc = '---  \t\na: 1\n---\n';
        const r = scanFrontMatter(doc);
        expect(r).not.toBeNull();
        expect(r.from).toBe(0);
        expect(r.contentFrom).toBe(doc.indexOf('a: 1'));
    });

    it('trailing spaces/tabs allowed on the closing fence, and are inside `to`', () => {
        const doc = '---\na: 1\n---  \t\nbody';
        const r = scanFrontMatter(doc);
        expect(r.to).toBe(doc.indexOf('\nbody'));
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1');
    });

    it('trailing spaces allowed on a "..." closing fence', () => {
        const doc = '---\na: 1\n...   \nbody';
        expect(scanFrontMatter(doc).to).toBe(doc.indexOf('\nbody'));
    });

    it('"----" opening is not a fence', () => {
        expect(scanFrontMatter('----\na: 1\n---\n')).toBeNull();
    });

    it('"--- x" opening is not a fence', () => {
        expect(scanFrontMatter('--- x\na: 1\n---\n')).toBeNull();
    });

    it('" ---" (leading space) opening is not a fence', () => {
        expect(scanFrontMatter(' ---\na: 1\n---\n')).toBeNull();
    });

    it('"--" opening is not a fence', () => {
        expect(scanFrontMatter('--\na: 1\n---\n')).toBeNull();
    });

    it('"...", not "---", as opening line is not a fence', () => {
        expect(scanFrontMatter('...\na: 1\n---\n')).toBeNull();
    });

    it('"----" is not a closing fence; the real one later wins', () => {
        const doc = '---\na: 1\n----\nb: 2\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\n----\nb: 2');
    });

    it('" ---" (indented) is not a closing fence', () => {
        const doc = '---\na: 1\n ---\nb: 2\n---\n';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\n ---\nb: 2');
    });

    it('"--- x" is not a closing fence', () => {
        const doc = '---\na: 1\n--- x\n---\n';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\n--- x');
    });

    it('"..." with trailing text is not a closing fence', () => {
        const doc = '---\na: 1\n... x\n---\n';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1\n... x');
    });

    it('"---" inside a line (key: ---) is not a closing fence', () => {
        const doc = '---\na: ---\n---\n';
        const r = scanFrontMatter(doc);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: ---');
    });

    it('the first closing fence wins; a later --- stays out of the range', () => {
        const doc = '---\na: 1\n---\nmiddle\n---\nend\n---\n';
        const r = scanFrontMatter(doc);
        expect(r.to).toBe(doc.indexOf('\nmiddle'));
    });

    it('a later "..." after the first closing fence is not consumed', () => {
        const doc = '---\na: 1\n---\nb\n...\n';
        expect(scanFrontMatter(doc).to).toBe(doc.indexOf('\nb\n'));
    });
});

describe('scanFrontMatter: null cases', () => {
    it('empty string', () => {
        expect(scanFrontMatter('')).toBeNull();
    });

    it('plain text', () => {
        expect(scanFrontMatter('hello\nworld')).toBeNull();
    });

    it('only an opening fence (unclosed)', () => {
        expect(scanFrontMatter('---')).toBeNull();
        expect(scanFrontMatter('---\n')).toBeNull();
    });

    it('unclosed with content', () => {
        expect(scanFrontMatter('---\ntitle: x\nmore: y\n')).toBeNull();
    });

    it('a blank line before --- means no front matter', () => {
        expect(scanFrontMatter('\n---\na: 1\n---\n')).toBeNull();
    });

    it('any text before --- means no front matter', () => {
        expect(scanFrontMatter('intro\n---\na: 1\n---\n')).toBeNull();
    });

    it('a space-only first line before --- means no front matter', () => {
        expect(scanFrontMatter(' \n---\na: 1\n---\n')).toBeNull();
    });

    it('a --- block later in the document is not front matter', () => {
        expect(scanFrontMatter('# T\n\n---\na: 1\n---\n')).toBeNull();
    });

    it('closing fence only: "a: 1\\n---" is not front matter', () => {
        expect(scanFrontMatter('a: 1\n---\n')).toBeNull();
    });
});

describe('scanFrontMatter: BOM and CRLF', () => {
    it('leading BOM: from is 1, offsets still exact', () => {
        const doc = '﻿---\na: 1\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(r.from).toBe(1);
        expect(r.contentFrom).toBe(doc.indexOf('a: 1'));
        expect(r.contentTo).toBe(doc.indexOf('\n---', 4));
        expect(r.to).toBe(doc.indexOf('\nbody'));
    });

    it('BOM then empty front matter', () => {
        const doc = '﻿---\n---';
        const r = scanFrontMatter(doc);
        expect(r.from).toBe(1);
        expect(r.to).toBe(doc.length);
        expect(r.contentFrom).toBe(r.contentTo);
    });

    it('BOM then a blank line then --- is not front matter', () => {
        expect(scanFrontMatter('﻿\n---\na: 1\n---\n')).toBeNull();
    });

    it('a BOM that is not at the very start is not skipped', () => {
        expect(scanFrontMatter('x﻿---\na: 1\n---\n')).toBeNull();
    });

    it('CRLF line endings work; to/contentTo stop before the "\\r"', () => {
        const doc = '---\r\ntitle: x\r\n---\r\nbody';
        const r = scanFrontMatter(doc);
        expect(r.from).toBe(0);
        expect(r.contentFrom).toBe(doc.indexOf('title'));
        expect(r.contentTo).toBe(doc.indexOf('\r\n---'));
        expect(r.to).toBe(doc.indexOf('\r\nbody'));
    });

    it('CRLF with "..." closing and empty content', () => {
        const doc = '---\r\n...\r\nbody';
        const r = scanFrontMatter(doc);
        expect(r.contentFrom).toBe(doc.indexOf('\r\n...') + 2);
        expect(r.contentFrom).toBe(r.contentTo);
        expect(r.to).toBe(doc.indexOf('\r\nbody'));
    });

    it('CRLF with trailing spaces on fences', () => {
        const doc = '---  \r\na: 1\r\n---  \r\nbody';
        const r = scanFrontMatter(doc);
        expect(r).not.toBeNull();
        expect(r.to).toBe(doc.indexOf('\r\nbody'));
    });

    it('BOM plus CRLF', () => {
        const doc = '﻿---\r\na: 1\r\n---\r\n';
        const r = scanFrontMatter(doc);
        expect(r.from).toBe(1);
        expect(doc.slice(r.contentFrom, r.contentTo)).toBe('a: 1');
    });

    it('CRLF unclosed is null', () => {
        expect(scanFrontMatter('---\r\na: 1\r\n')).toBeNull();
    });
});

describe('frontMatterSyntax: FrontMatter node', () => {
    it('produces FrontMatter covering exactly the scanned range', () => {
        const doc = '---\ntitle: x\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatter')).toEqual([[r.from, r.to]]);
    });

    it('two FrontMatterMark (one per fence line) and one FrontMatterContent, exact spans', () => {
        const doc = '---\ntitle: x\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatterMark')).toEqual([[0, 3], [doc.lastIndexOf('---'), r.to]]);
        expect(spans(doc, 'FrontMatterContent')).toEqual([[r.contentFrom, r.contentTo]]);
    });

    it('marks and content are children of FrontMatter; FrontMatter is a child of Document', () => {
        const doc = '---\ntitle: x\n---\n';
        expect(named(doc, 'FrontMatterMark').map((n) => n.parent)).toEqual(['FrontMatter', 'FrontMatter']);
        expect(named(doc, 'FrontMatterContent')[0].parent).toBe('FrontMatter');
        expect(named(doc, 'FrontMatter')[0].parent).toBe('Document');
    });

    it('fence mark spans include trailing spaces/tabs of the fence line', () => {
        const doc = '---  \na: 1\n---\t\nbody';
        expect(spans(doc, 'FrontMatterMark')).toEqual([[0, doc.indexOf('\n')], [doc.lastIndexOf('---'), doc.indexOf('\nbody')]]);
    });

    it('"..." closing line is a FrontMatterMark', () => {
        const doc = '---\na: 1\n...\nbody';
        expect(spans(doc, 'FrontMatterMark')[1]).toEqual([doc.indexOf('...'), doc.indexOf('\nbody')]);
    });

    it('empty front matter: two marks, no FrontMatterContent', () => {
        const doc = '---\n---\nbody';
        expect(spans(doc, 'FrontMatter')).toEqual([[0, doc.indexOf('\nbody')]]);
        expect(spans(doc, 'FrontMatterMark')).toEqual([[0, 3], [doc.indexOf('\n---') + 1, doc.indexOf('\nbody')]]);
        expect(named(doc, 'FrontMatterContent')).toEqual([]);
    });

    it('empty front matter with nothing after it', () => {
        const doc = '---\n---';
        expect(spans(doc, 'FrontMatter')).toEqual([[0, doc.length]]);
        expect(named(doc, 'FrontMatterContent')).toEqual([]);
    });

    it('only one FrontMatter node per document, even with later --- pairs', () => {
        const doc = '---\na: 1\n---\n\ntext\n\n---\nb: 2\n---\n';
        expect(named(doc, 'FrontMatter')).toHaveLength(1);
    });

    it('works with the extension passed alone (no math/footnote)', () => {
        const doc = '---\na: 1\n---\n';
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatter', soloParser)).toEqual([[r.from, r.to]]);
    });

    it('"..." closer: content line "a: 1" yields no heading', () => {
        const doc = '---\na: 1\n...\n';
        expect(named(doc, 'SetextHeading1')).toEqual([]);
        expect(named(doc, 'SetextHeading2')).toEqual([]);
    });
});

describe('frontMatterSyntax: nothing else inside the range', () => {
    const insideNames = (doc) => {
        const r = scanFrontMatter(doc);
        return nodes(doc)
            .filter((n) => n.name !== 'Document' && n.from >= r.from && n.to <= r.to && n.to > n.from)
            .map((n) => n.name);
    };
    const onlyFrontMatter = (doc) => {
        expect(insideNames(doc).filter((n) => !/^FrontMatter/.test(n))).toEqual([]);
    };

    it('no HorizontalRule, SetextHeading2 or Paragraph in a simple block', () => {
        const doc = '---\ntitle: x\n---\n';
        const names = insideNames(doc);
        expect(names).not.toContain('HorizontalRule');
        expect(names).not.toContain('SetextHeading2');
        expect(names).not.toContain('Paragraph');
    });

    it('the content line "title: x" is not a heading', () => {
        const doc = '---\ntitle: x\n---\n';
        expect(named(doc, 'SetextHeading1')).toEqual([]);
        expect(named(doc, 'SetextHeading2')).toEqual([]);
        expect(named(doc, 'HorizontalRule')).toEqual([]);
    });

    it('YAML that looks like markdown stays raw: "# comment"', () => {
        onlyFrontMatter('---\n# comment\na: 1\n---\n');
    });

    it('YAML list items are not a BulletList', () => {
        onlyFrontMatter('---\ntags:\n  - a\n  - b\n- c\n---\n');
    });

    it('YAML with $x$, [^1], > and ``` stays raw', () => {
        onlyFrontMatter('---\na: $x$\nb: [^1]\nc: > folded\n```\n---\n');
    });

    it('a blank line inside the block does not split it', () => {
        const doc = '---\na: 1\n\nb: 2\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatter')).toEqual([[r.from, r.to]]);
        onlyFrontMatter(doc);
    });

    it('a Hebrew value stays raw', () => {
        onlyFrontMatter('---\ntitle: שלום עולם\n---\n');
    });

    it('line-ending "a: 1" immediately before the closing --- is not a setext heading', () => {
        const doc = '---\na: 1\n---\n';
        expect(named(doc, 'SetextHeading2')).toEqual([]);
    });
});

describe('frontMatterSyntax: document after the block', () => {
    it('heading right after the closing fence parses normally', () => {
        const doc = '---\na: 1\n---\n# Title\n';
        expect(spans(doc, 'ATXHeading1')).toEqual([[doc.indexOf('# Title'), doc.indexOf('# Title') + 7]]);
    });

    it('paragraph after the block parses normally and starts after the range', () => {
        const doc = '---\na: 1\n---\nhello world\n';
        const p = named(doc, 'Paragraph');
        expect(p).toHaveLength(1);
        expect(p[0].from).toBe(doc.indexOf('hello'));
    });

    it('setext heading after the block is still a setext heading', () => {
        const doc = '---\na: 1\n---\nTitle\n---\n';
        expect(spans(doc, 'SetextHeading2')).toEqual([[doc.indexOf('Title'), doc.length - 1]]);
        expect(named(doc, 'HorizontalRule')).toEqual([]);
    });

    it('a later --- after a blank line is a HorizontalRule', () => {
        const doc = '---\na: 1\n---\n\ntext\n\n---\n\nmore\n';
        expect(spans(doc, 'HorizontalRule')).toEqual([[doc.lastIndexOf('---'), doc.lastIndexOf('---') + 3]]);
    });

    it('a second --- block later is not front matter: HR + paragraph/setext as today', () => {
        const doc = '---\na: 1\n---\n\ntext\n\n---\nb: 2\n---\n';
        expect(named(doc, 'FrontMatter')).toHaveLength(1);
        const second = doc.indexOf('---\nb');
        expect(nodes(doc).some((n) => n.name === 'HorizontalRule' && n.from === second)).toBe(true);
    });
});

describe('frontMatterSyntax: only at document start', () => {
    const noFM = (doc, p = parser) => expect(named(doc, 'FrontMatter', p)).toEqual([]);

    it('blank line before --- : no FrontMatter, HorizontalRule/setext as before', () => {
        const doc = '\n---\na: 1\n---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
    });

    it('text before --- : no FrontMatter, tree equals the base parse', () => {
        const doc = 'intro\n\n---\na: 1\n---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
        expect(named(doc, 'HorizontalRule').length).toBeGreaterThan(0);
    });

    it('setext collision later in doc: "title\\n---" still SetextHeading2', () => {
        const doc = 'text\n\ntitle\n---\n';
        noFM(doc);
        expect(spans(doc, 'SetextHeading2')).toHaveLength(1);
    });

    it('inside a blockquote at the start: not front matter', () => {
        const doc = '> ---\n> a: 1\n> ---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
    });

    it('inside a list item at the start: not front matter', () => {
        const doc = '- ---\n  a: 1\n  ---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
    });

    it('indented one space at the start: not front matter', () => {
        const doc = ' ---\na: 1\n---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
    });

    it('"----" at the start: not front matter', () => {
        const doc = '----\na: 1\n---\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
    });

    it('unclosed opening fence: not front matter, tree equals the base parse', () => {
        const doc = '---\ntitle: x\n\ntext\n';
        noFM(doc);
        expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
        expect(named(doc, 'HorizontalRule')).toHaveLength(1);
    });

    it('lone "---" document: HorizontalRule as before', () => {
        noFM('---');
        expect(shape('---')).toEqual(shape('---', baseParser));
        expect(named('---', 'HorizontalRule')).toHaveLength(1);
    });
});

describe('frontMatterSyntax: tree unchanged without front matter', () => {
    const docs = [
        '',
        'plain text',
        '# Heading\n\ntext\n\n---\n\nmore',
        'Title\n---\nbody\n',
        '- a\n- b\n\n***\n',
        '> quote\n> ---\n',
        '```js\n---\nx\n---\n```\n',
        'a $x$ b [^1]\n\n[^1]: note\n',
        '| a | b |\n|---|---|\n| 1 | 2 |\n',
        'text\n---\nmore\n---\n',
    ];
    docs.forEach((doc) => {
        it(`identical node tree for ${JSON.stringify(doc.slice(0, 24))}`, () => {
            expect(shape(doc, parser)).toEqual(shape(doc, baseParser));
        });
    });
});

describe('frontMatterSyntax: BOM and CRLF through the parser', () => {
    it('CRLF doc: FrontMatter from/to equals the scanner', () => {
        const doc = '---\r\ntitle: x\r\n---\r\nbody';
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatter')).toEqual([[r.from, r.to]]);
        expect(named(doc, 'HorizontalRule')).toEqual([]);
        expect(named(doc, 'SetextHeading2')).toEqual([]);
    });

    it('CRLF doc: two marks and one content node', () => {
        const doc = '---\r\ntitle: x\r\n---\r\nbody';
        expect(named(doc, 'FrontMatterMark')).toHaveLength(2);
        expect(named(doc, 'FrontMatterContent')).toHaveLength(1);
    });

    it('leading BOM: FrontMatter starts at 1, equals the scanner', () => {
        const doc = '﻿---\ntitle: x\n---\nbody';
        const r = scanFrontMatter(doc);
        expect(r.from).toBe(1);
        expect(spans(doc, 'FrontMatter')).toEqual([[1, r.to]]);
        expect(named(doc, 'HorizontalRule')).toEqual([]);
    });
});

describe('frontMatterSyntax: composes with the other extensions', () => {
    it('inline math after the block still parses', () => {
        const doc = '---\ntitle: x\n---\n\nsee $x^2$ here\n';
        expect(named(doc, 'InlineMath').length + named(doc, 'Math').length).toBeGreaterThan(0);
        const r = scanFrontMatter(doc);
        expect(spans(doc, 'FrontMatter')).toEqual([[r.from, r.to]]);
    });

    it('footnote reference and definition after the block still parse', () => {
        const doc = '---\ntitle: x\n---\n\nclaim [^1]\n\n[^1]: the note\n';
        expect(spans(doc, 'FootnoteReference')).toEqual([[doc.indexOf('[^1]'), doc.indexOf('[^1]') + 4]]);
        expect(named(doc, 'FootnoteDefinition')).toHaveLength(1);
    });

    it('front matter + $x$ + [^1] together: all three node kinds, in order', () => {
        const doc = '---\ntitle: x\n---\n$x$ and [^1]\n\n[^1]: n\n';
        const fm = named(doc, 'FrontMatter')[0];
        const ref = named(doc, 'FootnoteReference')[0];
        expect(fm).toBeDefined();
        expect(ref).toBeDefined();
        expect(ref.from).toBeGreaterThanOrEqual(fm.to);
        expect(named(doc, 'InlineMath').length + named(doc, 'Math').length).toBeGreaterThan(0);
    });

    it('math block after the block still parses', () => {
        const doc = '---\na: 1\n---\n\n$$\nx\n$$\n';
        expect(nodes(doc).some((n) => /Math/.test(n.name) && n.from >= doc.indexOf('$$'))).toBe(true);
    });

    it('$x$ and [^1] inside the YAML are NOT parsed (raw content)', () => {
        const doc = '---\na: $x$\nb: [^1]\n---\n';
        const r = scanFrontMatter(doc);
        const inside = nodes(doc).filter((n) => n.from >= r.from && n.to <= r.to && !/^FrontMatter|^Document$/.test(n.name));
        expect(inside).toEqual([]);
    });

    it('extension order does not matter', () => {
        const alt = markdown({ base: markdownLanguage, extensions: [frontMatterSyntax, footnoteSyntax, mathSyntax] }).language.parser;
        const doc = '---\na: 1\n---\n$x$ [^1]\n\n[^1]: n\n';
        expect(shape(doc, alt)).toEqual(shape(doc, parser));
    });
});

describe('frontMatterSyntax: parser agrees with scanFrontMatter at read-chunk edges', () => {
    it('closer straddling 1 KB / 2 KB edges, CRLF, a line longer than a chunk, BOM, and unclosed', () => {
        const check = (doc) => {
            const fm = scanFrontMatter(doc);
            const got = spans(doc, 'FrontMatter');
            expect(got).toEqual(fm ? [[fm.from, fm.to]] : []);
        };
        for (const eol of ['\n', '\r\n']) {
            for (const edge of [1024, 2048]) {
                for (let pad = edge - 12; pad <= edge + 2; pad++) {
                    const head = '---' + eol + 'k: ' + 'x'.repeat(pad) + eol;
                    check(head + '---' + eol + 'body');
                    check(head + '...' + eol);
                    check('\uFEFF' + head + '---');
                }
            }
            check('---' + eol + 'k: ' + 'y'.repeat(5000) + eol + '---' + eol + 'body'); // one line > several chunks
            check('---' + eol + ('a: b' + eol).repeat(1000)); // unclosed, ~5 KB
        }
    });
});

describe('scanFrontMatter / parser: size cap (FRONT_MATTER_MAX_LINES)', () => {
    // Pinned: the cap counts YAML lines strictly between the fences. Up to MAX is front matter, MAX + 1 is not.
    // One rule: the scanner returns null past it, so the lezer node (and every other consumer) is absent too.
    const docWith = (n, close = '---', eol = '\n') =>
        `---${eol}${Array.from({ length: n }, (_, i) => `k${i}: ${i}`).join(eol)}${n ? eol : ''}${close}${eol}body`;

    it('exports the cap as 500', () => {
        expect(FRONT_MATTER_MAX_LINES).toBe(500);
    });

    for (const close of ['---', '...']) {
        for (const eol of ['\n', '\r\n']) {
            const tag = `closer ${JSON.stringify(close)}, ${JSON.stringify(eol)}`;
            it(`MAX YAML lines is front matter, MAX + 1 is null (${tag})`, () => {
                const ok = docWith(FRONT_MATTER_MAX_LINES, close, eol);
                const r = scanFrontMatter(ok);
                expect(r).not.toBeNull();
                expect(ok.slice(r.to - 3, r.to)).toBe(close);
                expect(scanFrontMatter(docWith(FRONT_MATTER_MAX_LINES + 1, close, eol))).toBeNull();
            });
        }
    }

    it('the BOM does not change the boundary', () => {
        expect(scanFrontMatter('\uFEFF' + docWith(FRONT_MATTER_MAX_LINES))).not.toBeNull();
        expect(scanFrontMatter('\uFEFF' + docWith(FRONT_MATTER_MAX_LINES + 1))).toBeNull();
    });

    it('blank lines count as lines', () => {
        const ok = '---\n' + '\n'.repeat(FRONT_MATTER_MAX_LINES) + '---\nbody';
        expect(scanFrontMatter(ok)).not.toBeNull();
        expect(scanFrontMatter('---\n' + '\n'.repeat(FRONT_MATTER_MAX_LINES + 1) + '---\nbody')).toBeNull();
    });

    it('a closer past the cap is not found even when it exists (the 600-line case)', () => {
        expect(scanFrontMatter('---\n' + 'a: 1\n'.repeat(600) + '---\nbody')).toBeNull();
    });

    it('unclosed opening fence in a ~1 MB document -> null', () => {
        expect(scanFrontMatter('---\n' + 'a: 1\n'.repeat(200000))).toBeNull();
    });

    it('closer beyond the cap in a ~1 MB document -> null', () => {
        expect(scanFrontMatter('---\n' + 'a: 1\n'.repeat(200000) + '---\n')).toBeNull();
    });

    it('parser: FrontMatter node at MAX lines, none at MAX + 1, same span as the scanner', () => {
        const ok = docWith(FRONT_MATTER_MAX_LINES);
        const r = scanFrontMatter(ok);
        expect(spans(ok, 'FrontMatter')).toEqual([[r.from, r.to]]);
        const over = docWith(FRONT_MATTER_MAX_LINES + 1);
        expect(spans(over, 'FrontMatter')).toEqual([]);
        expect(spans(over, 'FrontMatterMark')).toEqual([]);
        expect(spans(over, 'FrontMatterContent')).toEqual([]);
    });

    it('parser past the cap yields exactly the tree of a parser without the extension', () => {
        const over = '---\n' + 'a: 1\n'.repeat(600) + '---\nbody';
        expect(shape(over)).toEqual(shape(over, baseParser));
    });

    it('parser: unclosed fence in a ~1 MB document: no node, same tree as without the extension', () => {
        const doc = '---\n' + 'a: 1\n'.repeat(200000);
        expect(spans(doc, 'FrontMatter')).toEqual([]);
    });
});

describe('parser: cap boundary agrees with the scanner when the closer sits past read-chunk edges', () => {
    // Early stop in the chunked read must never reject a block whose closer is within the cap, whatever the line width.
    it('500 YAML lines (node) vs 501 (none) for line widths 1, 30, 200 and CRLF', () => {
        for (const pad of [0, 30, 200]) {
            for (const eol of ['\n', '\r\n']) {
                const line = (i) => `k${i % 10}: ${'x'.repeat(pad)}`;
                const mk = (n) => '---' + eol + Array.from({ length: n }, (_, i) => line(i)).join(eol) + eol + '---' + eol + 'body';
                const ok = mk(FRONT_MATTER_MAX_LINES), over = mk(FRONT_MATTER_MAX_LINES + 1);
                const r = scanFrontMatter(ok);
                expect(r, `scan ${pad} ${JSON.stringify(eol)}`).not.toBeNull();
                expect(spans(ok, 'FrontMatter'), `node ${pad} ${JSON.stringify(eol)}`).toEqual([[r.from, r.to]]);
                expect(scanFrontMatter(over)).toBeNull();
                expect(spans(over, 'FrontMatter')).toEqual([]);
            }
        }
    });
});
