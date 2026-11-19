import { describe, it, expect } from 'vitest';
import { footnoteTooltipDom } from '../footnotes';

describe('footnoteTooltipDom', () => {
    it('renders inline markdown; link is a span.cm-link, never an <a>', () => {
        const el = footnoteTooltipDom('**b** and *i* and `c` and [l](https://x.com)');
        expect(el.matches('div.cm-tooltip-cursor.cm-footnote-tooltip')).toBe(true);
        expect(el.querySelector('strong')?.textContent).toBe('b');
        expect(el.querySelector('em')?.textContent).toBe('i');
        expect(el.querySelector('code')?.textContent).toBe('c');
        expect(el.querySelector('span.cm-link')?.textContent).toBe('l');
        expect(el.querySelector('a')).toBeNull();
        expect(el.textContent).not.toContain('**');
    });
    it('raw html is inert', () => {
        const el = footnoteTooltipDom('<img src=x onerror=alert(1)> <script>x</script>');
        expect(el.querySelector('img[onerror]')).toBeNull();
        expect(el.querySelector('script')).toBeNull();
    });
    it('plain note gives its text', () => expect(footnoteTooltipDom('just text').textContent).toBe('just text'));
});
