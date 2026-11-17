import { renderTex } from './math';
import { scanInlineMath, findClose, INLINE_MATH_MAX } from '../extensions/mathSyntax';

// Math for marked: same rules as the editor (mathSyntax). Each formula becomes a random
// placeholder that survives sanitizing; finish() swaps it for MathJax's sanitized SVG.
export const createMath = (nonce) => {
    const formulas = [];
    const marker = `NFMATH${nonce}I`;
    const token = (i) => `${marker}${i}E`;
    const re = new RegExp(`${marker}(\\d+)E`, 'g');
    let rendered = [];

    const extension = {
        extensions: [
            {
                name: 'blockMath',
                level: 'block',
                start: (src) => src.match(/^ {0,3}\$\$/m)?.index,
                tokenizer(src) {
                    const m = /^ {0,3}\$\$/.exec(src);
                    if (!m) return undefined;
                    const close = findClose(src, m[0].length);
                    if (close < 0) return undefined; // unclosed: stays text, like the editor
                    const eol = src.indexOf('\n', close);
                    const raw = eol < 0 ? src : src.slice(0, eol + 1);
                    return { type: 'blockMath', raw, text: src.slice(m[0].length, close) };
                },
                renderer: (t) => `<p>${token(formulas.push({ tex: t.text, display: true, block: true, raw: `$$${t.text}$$` }) - 1)}</p>\n`,
            },
            {
                name: 'inlineMath',
                level: 'inline',
                start: (src) => { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
                tokenizer(src) {
                    const head = src.slice(0, INLINE_MATH_MAX);
                    const eol = head.indexOf('\n');
                    const m = scanInlineMath(eol < 0 ? head : head.slice(0, eol));
                    if (!m) return undefined;
                    const mark = m.display ? 2 : 1;
                    return { type: 'inlineMath', raw: src.slice(0, m.end), text: src.slice(mark, m.end - mark), display: m.display };
                },
                renderer: (t) => token(formulas.push({ tex: t.text, display: t.display, block: false, raw: t.raw }) - 1),
            },
        ],
    };

    // Rendering is async: await this before the sync finish().
    const prepare = async () => {
        rendered = await Promise.all(formulas.map((f) => renderTex(f.tex, { display: f.display })));
    };

    // Swap on the parsed DOM, not the string: a formula can land in an attribute (an image's
    // alt text), where markup would break out of the quotes. There it becomes its source text.
    const finish = (root) => {
        for (const el of root.querySelectorAll('*')) {
            for (const attr of el.attributes) {
                if (attr.value.includes(marker)) attr.value = attr.value.replace(re, (w, i) => formulas[Number(i)]?.raw ?? w);
            }
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const hits = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes(marker)) hits.push(n);
        for (const node of hits) {
            const frag = document.createDocumentFragment();
            node.data.split(re).forEach((part, k) => { // [text, index, text, index, ..., text]
                if (k % 2 === 0) { if (part) frag.append(part); return; }
                const f = formulas[Number(part)];
                const span = document.createElement('span');
                span.className = f.block ? 'math math-block' : f.display ? 'math math-display' : 'math math-inline';
                span.dir = 'ltr';
                span.innerHTML = rendered[Number(part)]; // sanitized SVG from renderTex
                frag.append(span);
            });
            node.replaceWith(frag);
        }
    };

    return { extension, prepare, finish, hasFormulas: () => formulas.length > 0 };
};
