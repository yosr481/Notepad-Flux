import { describe, it, expect } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { mathSyntax } from '../mathSyntax';

// Spec: Docs/internal/math-spec.md ("Syntax", "Modules and public API").

const parser = markdown({ base: markdownLanguage, extensions: [mathSyntax] }).language.parser;

// Flat list of {name, from, to} for every node in document order.
const nodes = (doc) => {
    const out = [];
    parser.parse(doc).iterate({ enter: (n) => { out.push({ name: n.name, from: n.from, to: n.to }); } });
    return out;
};
const named = (doc, name) => nodes(doc).filter((n) => n.name === name);
const noMath = (doc) =>
    expect(nodes(doc).filter((n) => /Math/.test(n.name))).toEqual([]);

describe('mathSyntax: inline $...$', () => {
    it('parses $x$ as InlineMath covering the whole span with two InlineMathMark delimiters', () => {
        const doc = 'a $x$ b';
        expect(named(doc, 'InlineMath')).toEqual([{ name: 'InlineMath', from: 2, to: 5 }]);
        const marks = named(doc, 'InlineMathMark');
        expect(marks.map((m) => [m.from, m.to])).toEqual([[2, 3], [4, 5]]);
    });

    it('parses $a^2+b^2$ at line start as one InlineMath', () => {
        expect(named('$a^2+b^2$', 'InlineMath')).toEqual([{ name: 'InlineMath', from: 0, to: 9 }]);
    });

    it('does not treat an escaped \\$ inside as the closing delimiter', () => {
        expect(named('$a\\$b$', 'InlineMath')).toEqual([{ name: 'InlineMath', from: 0, to: 6 }]);
    });

    it('finds two separate math spans on one line', () => {
        expect(named('$a$ and $b$', 'InlineMath').map((n) => [n.from, n.to])).toEqual([[0, 3], [8, 11]]);
    });

    it('is not math: "costs $5 and $10" (closing $ would be followed by a digit)', () => noMath('costs $5 and $10'));
    it('is not math: "$ x $" (whitespace after opener)', () => noMath('$ x $'));
    it('is not math: "$x $" (whitespace before closer)', () => noMath('$x $'));
    it('is not math: "\\$5" (escaped dollar is literal)', () => noMath('\\$5'));
    it('is not math: "\\$x\\$" (both dollars escaped)', () => noMath('\\$x\\$'));
    it('is not math: "$x" with no closing $ on the line', () => noMath('$x'));
    it('is not math when the closing $ is on the next line (same-line rule)', () => noMath('$x\ny$'));
    it('is not math when the formula is longer than 1000 characters (bounded scan)', () => {
        noMath('$' + 'a'.repeat(1001) + '$');
        expect(named('$' + 'a'.repeat(900) + '$', 'InlineMath')).toHaveLength(1);
    });
    it('is not math: "$$" with empty content', () => noMath('a $$ b'));
    it('is not math: "$a$5" (closing $ followed by a digit)', () => noMath('$a$5'));

    it('produces no Emphasis inside $a*b*c$', () => {
        const doc = '$a*b*c$';
        expect(named(doc, 'InlineMath')).toHaveLength(1);
        expect(named(doc, 'Emphasis')).toEqual([]);
        expect(named(doc, 'EmphasisMark')).toEqual([]);
    });

    it('produces no emphasis for $a_1 + b_1$ and $a**b**c$', () => {
        for (const doc of ['$a_1 + b_1$', '$a**b**c$']) {
            expect(named(doc, 'InlineMath')).toHaveLength(1);
            expect(named(doc, 'Emphasis')).toEqual([]);
            expect(named(doc, 'StrongEmphasis')).toEqual([]);
        }
    });

    it('still parses emphasis outside the math on the same line', () => {
        expect(named('*a* $x$', 'Emphasis')).toHaveLength(1);
    });
});

describe('mathSyntax: inline display $$...$$', () => {
    it('parses a $$x$$ inside a paragraph as InlineMath with $$ marks', () => {
        const doc = 'see $$x$$ here';
        expect(named(doc, 'InlineMath')).toEqual([{ name: 'InlineMath', from: 4, to: 9 }]);
        expect(named(doc, 'InlineMathMark').map((m) => [m.from, m.to])).toEqual([[4, 6], [7, 9]]);
        expect(named(doc, 'BlockMath')).toEqual([]);
    });
});

describe('mathSyntax: block $$', () => {
    it('parses a single-line $$x$$ at line start as BlockMath', () => {
        const doc = '$$x$$';
        expect(named(doc, 'BlockMath')).toEqual([{ name: 'BlockMath', from: 0, to: 5 }]);
        expect(named(doc, 'BlockMathMark').length).toBeGreaterThanOrEqual(1);
    });

    it('includes text after the closing $$ on that line in the block', () => {
        const doc = '$$x$$ tail\nnext';
        const [b] = named(doc, 'BlockMath');
        expect(b.from).toBe(0);
        expect(b.to).toBe('$$x$$ tail'.length);
    });

    it('parses a multi-line block from the opening $$ line to the closing $$ line', () => {
        const doc = 'before\n\n$$\nx^2\n+ y\n$$\n\nafter';
        const start = doc.indexOf('$$');
        const end = doc.indexOf('$$', start + 2) + 2;
        expect(named(doc, 'BlockMath')).toEqual([{ name: 'BlockMath', from: start, to: end }]);
        const marks = named(doc, 'BlockMathMark');
        expect(marks.length).toBeGreaterThanOrEqual(2);
        expect(marks[0].from).toBe(start);
        expect(marks[marks.length - 1].to).toBe(end);
    });

    it('ends the block at the FIRST line containing $$ (following text is not math)', () => {
        const doc = '$$\na\n$$\nplain $x$ text\n$$\nb\n$$';
        const blocks = named(doc, 'BlockMath');
        expect(blocks[0].to).toBe('$$\na\n$$'.length);
        expect(blocks).toHaveLength(2);
        // the $x$ between the two blocks is ordinary inline math
        expect(named(doc, 'InlineMath')).toHaveLength(1);
    });

    it('does not parse markdown inside a block (no emphasis, no list)', () => {
        const doc = '$$\na*b*c\n- item\n$$';
        expect(named(doc, 'BlockMath')).toHaveLength(1);
        expect(named(doc, 'Emphasis')).toEqual([]);
        expect(named(doc, 'BulletList')).toEqual([]);
    });

    it('unclosed $$ (no closing $$ below) is NOT a block: no math nodes, rest parses as markdown', () => {
        const doc = '$$\nx\n\n# Heading\n\n**bold** and *em*';
        expect(named(doc, 'BlockMath')).toEqual([]);
        expect(named(doc, 'BlockMathMark')).toEqual([]);
        expect(named(doc, 'ATXHeading1')).toHaveLength(1);
        expect(named(doc, 'StrongEmphasis')).toHaveLength(1);
        expect(named(doc, 'Emphasis')).toHaveLength(1);
    });

    it('a lone $$ line before a later closed block does not swallow anything; the later block still parses', () => {
        const doc = 'para\n\n$$\nx\n$$\n\n# H';
        expect(named(doc, 'BlockMath')).toHaveLength(1);
        expect(named(doc, 'ATXHeading1')).toHaveLength(1);
    });

    it('accepts up to 3 spaces of indent before the opening $$', () => {
        for (const indent of [' ', '  ', '   ']) {
            const doc = `${indent}$$\nx\n$$`;
            expect(named(doc, 'BlockMath'), `indent ${indent.length}`).toHaveLength(1);
        }
    });

    it('does not open a block with 4 spaces of indent (indented code instead)', () => {
        const doc = '    $$\n    x\n    $$';
        expect(named(doc, 'BlockMath')).toEqual([]);
        expect(named(doc, 'CodeBlock').length).toBe(1);
    });
});

describe('mathSyntax: pathological input', () => {
    it('a 300 KB line of "$a " repeated parses fully in well under 5 s', () => {
        const doc = '$a '.repeat(100000);
        const t = Date.now();
        parser.parse(doc);
        expect(Date.now() - t).toBeLessThan(5000);
    }, 30000);
});

describe('mathSyntax: never math', () => {
    it('inline code span containing $x$ has no math nodes', () => noMath('`$x$`'));
    it('code span containing $$x$$ has no math nodes', () => noMath('a `$$x$$` b'));
    it('fenced code containing inline and block math has no math nodes', () =>
        noMath('```\n$x$\n$$\ny\n$$\n```'));
    it('tilde fence has no math nodes', () => noMath('~~~\n$x$\n~~~'));
    it('indented code block has no math nodes', () => noMath('para\n\n    $x$ and $$y$$'));
    it('HTML comment containing $x$ has no math nodes', () => noMath('<!-- $x$ -->'));
    it('link URL containing $x$ has no math nodes', () => noMath('[a](http://e.com/$x$y$z)'));
});
