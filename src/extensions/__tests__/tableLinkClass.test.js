import { describe, it, expect } from 'vitest';
import { tableDOM } from '../tableCells';

describe('table cell links', () => {
    it('anchor carries cm-link so it takes the themed link colour', () => {
        const data = { align: [null], head: [['h']], body: [[[{ k: 'a', href: 'https://x.com', c: ['l'] }]]] };
        const a = tableDOM(data, null).querySelector('a');
        expect(a.classList.contains('cm-link')).toBe(true);
    });
});
