import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../sanitize';

// F6 T1: sub joins sup in ALLOWED_TAGS. Attributes stay filtered by the existing allowlist (no onclick/style/data-*).
describe('sanitizeHTML: sub and sup', () => {
    it('keeps <sub> and <sup>', () => {
        expect(sanitizeHTML('<p>H<sub>2</sub>O x<sup>2</sup></p>')).toBe('<p>H<sub>2</sub>O x<sup>2</sup></p>');
    });
    it('<sub onclick=...> keeps the tag, loses the attribute', () => {
        expect(sanitizeHTML('<sub onclick="alert(1)">2</sub>')).toBe('<sub>2</sub>');
    });
    it('<sub style/data-x/id> lose those attributes', () => {
        expect(sanitizeHTML('<sub style="color:red" data-x="1" id="a">2</sub>')).toBe('<sub>2</sub>');
    });
    it('<sup onclick=...> keeps the tag, loses the attribute', () => {
        expect(sanitizeHTML('<sup onclick="alert(1)">2</sup>')).toBe('<sup>2</sup>');
    });
    it('script inside sub is still removed', () => {
        expect(sanitizeHTML('<sub><script>alert(1)</script>2</sub>')).toBe('<sub>2</sub>');
    });
});
