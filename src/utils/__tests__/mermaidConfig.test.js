import { describe, it, expect } from 'vitest';
import { MERMAID_CONFIG as c } from '../mermaidConfig';

// Fixed, document-proof Mermaid settings (spec "Library"). Shared by the frame (which applies them) and mermaid.js (re-export).
describe('MERMAID_CONFIG', () => {
    it('pins the fixed settings', () => {
        expect(c.startOnLoad).toBe(false);
        expect(c.securityLevel).toBe('strict');
        expect(c.htmlLabels).toBe(false);
        expect(c.flowchart.htmlLabels).toBe(false);
    });

    it('secure list covers every key a %%{init}%% directive or front matter must not change', () => {
        for (const k of ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'themeCSS',
            'themeVariables', 'fontFamily', 'htmlLabels', 'flowchart', 'theme', 'look', 'darkMode',
            'altFontFamily', 'dompurifyConfig', 'kanban']) {
            expect(c.secure).toContain(k);
        }
    });

    it('does not set theme itself (the frame adds it per render)', () => {
        expect(c).not.toHaveProperty('theme');
    });
});
