import { describe, it, expect } from 'vitest';
import { TextSpanWidget } from '../widgets';

// C4: EntityWidget + OrderedMarkerWidget fold into TextSpanWidget(text, className).
// Both originals returned ignoreEvent() === false (checked pre-refactor), so there is
// no per-class rule and no third ctor option: ignoreEvent is always false.
describe('TextSpanWidget', () => {
    it('toDOM gives <span class=className>text</span>', () => {
        const dom = new TextSpanWidget('&', 'cm-entity').toDOM();
        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('cm-entity');
        expect(dom.textContent).toBe('&');
        expect(dom.outerHTML).toBe('<span class="cm-entity">&amp;</span>');
    });

    it('ordered-marker usage', () => {
        expect(new TextSpanWidget('2.', 'cm-ordered-marker').toDOM().outerHTML)
            .toBe('<span class="cm-ordered-marker">2.</span>');
    });

    it('text is set as text, never parsed as HTML', () => {
        const dom = new TextSpanWidget('<b>x</b>', 'c').toDOM();
        expect(dom.children.length).toBe(0);
        expect(dom.textContent).toBe('<b>x</b>');
    });

    it('eq is true only when text and className both match', () => {
        const w = new TextSpanWidget('a', 'x');
        expect(w.eq(new TextSpanWidget('a', 'x'))).toBe(true);
        expect(w.eq(new TextSpanWidget('b', 'x'))).toBe(false);
        expect(w.eq(new TextSpanWidget('a', 'y'))).toBe(false);
        expect(w.eq(new TextSpanWidget('b', 'y'))).toBe(false);
    });

    it('same text, different class (entity vs ordered marker) are not equal', () => {
        expect(new TextSpanWidget('1.', 'cm-entity').eq(new TextSpanWidget('1.', 'cm-ordered-marker'))).toBe(false);
    });

    it('ignoreEvent is false (as both originals)', () => {
        expect(new TextSpanWidget('a', 'x').ignoreEvent()).toBe(false);
    });
});
