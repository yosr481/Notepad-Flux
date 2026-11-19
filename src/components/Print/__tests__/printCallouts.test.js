import { readFileSync, existsSync } from 'node:fs';
import { CALLOUT_TYPES } from '../../../extensions/calloutSyntax';

// Callout export CSS is ONE shared plain stylesheet, src/styles/calloutExport.css.
// - HTML export inlines it (export.js: import css from '...calloutExport.css?raw').
// - PDF/Print renders it through PrintDocument.jsx (plain import of the same file).
// Print.module.css must NOT carry a second copy of the callout rules.

// Paths are relative to the repo root (vitest cwd), same convention as the original test.
const CSS_PATH = 'src/styles/calloutExport.css';
const PRINT_DOC_PATH = 'src/components/Print/PrintDocument.jsx';
const PRINT_MODULE_PATH = 'src/components/Print/Print.module.css';
const EXPORT_PATH = 'src/utils/export.js';

const read = (p) => readFileSync(p, 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// Innermost { ... } blocks only, so rules nested in @media still parse and at-rule headers are skipped.
// Returns [{ selectors: string[], body: string }].
function parseRules(css) {
    const rules = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(stripComments(css)))) {
        const selectors = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        if (selectors.length === 0 || selectors[0].startsWith('@')) continue;
        rules.push({ selectors, body: m[2] });
    }
    return rules;
}

const rulesFor = (rules, selector) => rules.filter((r) => r.selectors.includes(selector));
const declValue = (body, prop) => {
    const re = new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, 'i');
    const m = body.match(re);
    return m ? m[1].trim() : null;
};

describe('calloutExport.css (shared HTML export + PDF/Print stylesheet)', () => {
    it('exists at src/styles/calloutExport.css', () => {
        expect(existsSync(CSS_PATH)).toBe(true);
    });

    it('defines .callout, .callout-title and .callout-content', () => {
        const rules = parseRules(read(CSS_PATH));
        for (const sel of ['.callout', '.callout-title', '.callout-content']) {
            expect(rulesFor(rules, sel).length, sel).toBeGreaterThan(0);
        }
    });

    it('defines a rule for every CALLOUT_TYPES canonical as .callout-<type>', () => {
        const rules = parseRules(read(CSS_PATH));
        for (const type of Object.keys(CALLOUT_TYPES)) {
            expect(rulesFor(rules, `.callout-${type}`).length, `.callout-${type}`).toBeGreaterThan(0);
        }
    });

    it('.callout sets an explicit color and an explicit background (no inherited defaults)', () => {
        const rules = parseRules(read(CSS_PATH));
        const callout = rulesFor(rules, '.callout');
        const colorDecls = callout.map((r) => declValue(r.body, 'color')).filter(Boolean);
        const bgDecls = callout.map((r) => declValue(r.body, 'background(?:-color)?')).filter(Boolean);
        expect(colorDecls.length, 'color declaration on .callout').toBeGreaterThan(0);
        expect(bgDecls.length, 'background declaration on .callout').toBeGreaterThan(0);
        // Pinned: a keyword that defers to the default is not "explicit".
        for (const v of [...colorDecls, ...bgDecls]) {
            expect(v).not.toMatch(/^(inherit|initial|unset|revert)\b/i);
        }
    });

    it('.callout has print-color-adjust: exact (backgrounds survive printing)', () => {
        // Pinned: unprefixed property, on the .callout rule itself.
        const rules = parseRules(read(CSS_PATH));
        const ok = rulesFor(rules, '.callout').some((r) => declValue(r.body, 'print-color-adjust') === 'exact');
        expect(ok).toBe(true);
    });

    it('the svg icon in .callout-title has a fixed size (width and height)', () => {
        // Pinned: sizing lives on .callout-icon or on `.callout-title svg`; both width and height required.
        const rules = parseRules(read(CSS_PATH));
        const iconRules = rules.filter((r) =>
            r.selectors.includes('.callout-icon') || r.selectors.includes('.callout-title svg'),
        );
        const sized = iconRules.some((r) => declValue(r.body, 'width') && declValue(r.body, 'height'));
        expect(sized).toBe(true);
    });
});

describe('PDF/Print wiring', () => {
    it('PrintDocument.jsx imports the shared calloutExport.css (plain import, not ?raw)', () => {
        const src = read(PRINT_DOC_PATH);
        expect(src).toMatch(/import\s+(?:[^;]*?from\s+)?['"][^'"]*calloutExport\.css['"]/);
        expect(src).not.toMatch(/calloutExport\.css\?raw/);
    });

    it('Print.module.css holds no second copy of the callout rules', () => {
        const rules = parseRules(read(PRINT_MODULE_PATH));
        const callout = rules.filter((r) => r.selectors.some((s) => /\.callout\b/.test(s)));
        expect(callout).toEqual([]);
    });
});

describe('HTML export wiring', () => {
    it("export.js inlines calloutExport.css via import ... from '...calloutExport.css?raw'", () => {
        const src = read(EXPORT_PATH);
        expect(src).toMatch(/import\s+\w+\s+from\s+['"][^'"]*calloutExport\.css\?raw['"]/);
    });
});
