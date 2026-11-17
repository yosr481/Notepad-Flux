// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { lucideSvg } from '../lucideSvg';
import { CALLOUT_TYPES } from '../../extensions/calloutSyntax';

// Guards against a lucide-react bump renaming/removing the undocumented `__iconData` export.
describe('lucideSvg', () => {
    const names = [...new Set(Object.values(CALLOUT_TYPES).map((t) => t.icon)), 'chevron-down'];
    it.each(names)('%s resolves to a non-empty <svg>', (name) => {
        const svg = lucideSvg(name, 'x');
        expect(svg).not.toBeNull();
        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.childNodes.length).toBeGreaterThan(0);
    });
    it('unknown icon returns null', () => {
        expect(lucideSvg('no-such-icon', 'x')).toBeNull();
    });
});
