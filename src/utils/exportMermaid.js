import { renderMermaid } from './mermaid';

// Mermaid for marked: each ```mermaid fence becomes a nonce placeholder paragraph that survives
// sanitizing; prepare() renders, finish() swaps the placeholder for the loader-sanitized svg.
export const createMermaid = (nonce) => {
    const sources = [];
    const marker = `NFMERMAID${nonce}I`;
    const re = new RegExp(`^${marker}(\\d+)E$`);
    let rendered = [];

    const extension = {
        renderer: {
            code({ text, lang }) {
                if ((lang ?? '').trim().split(/\s+/)[0].toLowerCase() !== 'mermaid') return false;
                return `<p>${marker}${sources.push(text) - 1}E</p>\n`;
            },
        },
    };

    const prepare = async () => {
        rendered = await Promise.all(sources.map((s) => renderMermaid(s, { theme: 'default' })));
    };

    // Only a <p> whose whole text is a placeholder with our nonce is swapped.
    const finish = (root) => {
        for (const p of root.querySelectorAll('p')) {
            const m = re.exec(p.textContent);
            if (!m || p.children.length) continue;
            const r = rendered[Number(m[1])];
            let el;
            if (r.error !== undefined) {
                el = document.createElement('pre');
                el.className = 'mermaid-error';
                el.textContent = `${sources[Number(m[1])]}\n\n${r.error}`;
            } else {
                el = document.createElement('div');
                el.className = 'mermaid-diagram';
                el.dir = 'ltr';
                el.innerHTML = r.svg; // sanitized by the mermaid loader
            }
            p.replaceWith(el);
        }
    };

    return { extension, prepare, finish, has: () => sources.length > 0 };
};
