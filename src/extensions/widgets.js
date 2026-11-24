import { WidgetType } from "@codemirror/view";
import { tableDOM } from './tableCells';

export class BulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-bullet";
        span.textContent = "•";
        return span;
    }

    eq(other) { return true; }

    ignoreEvent() { return false; }
}

export class CheckboxWidget extends WidgetType {
    constructor(checked) {
        super();
        this.checked = checked;
    }

    toDOM(view) {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = this.checked;
        input.className = "cm-checkbox";

        // The widget replaces exactly the TaskMarker "[ ]", so its start is the "[".
        // Works whatever precedes the bullet: "> ", "+ ", "1. ".
        const toggle = () => {
            const pos = view.posAtDOM(input);
            if (pos === null) return;
            const marker = view.state.doc.sliceString(pos, pos + 3);
            if (!/^\[[ xX]\]$/.test(marker)) return;
            view.dispatch({
                changes: { from: pos + 1, to: pos + 2, insert: marker[1] === ' ' ? 'x' : ' ' }
            });
        };
        // The box shows the doc, never its own native toggle (else screen and file can disagree).
        // A mouse toggles on mousedown; Space and assistive tech send only a click (detail 0).
        input.addEventListener("click", (e) => {
            e.preventDefault();
            if (e.detail === 0) toggle();
        });
        input.addEventListener("mousedown", (e) => {
            e.preventDefault(); // Prevent default focus change issues
            toggle();
        });
        return input;
    }

    eq(other) { return other.checked === this.checked; }

    ignoreEvent() { return true; }
}

export class HRWidget extends WidgetType {
    toDOM() {
        const hr = document.createElement("hr");
        hr.className = "cm-hr";
        return hr;
    }

    eq(other) { return true; }

    ignoreEvent() { return true; }
}

export class TableWidget extends WidgetType {
    // data: see tableCells.js
    constructor(data) {
        super();
        this.data = data;
    }

    toDOM(view) {
        const div = document.createElement("div");
        div.className = "cm-table-widget";
        if (this.data) div.append(tableDOM(this.data, view));

        // Links open on Ctrl/Cmd+click only, like outside tables; a plain click edits the table.
        const opensLink = (e) => (e.ctrlKey || e.metaKey) && e.target.closest('a');
        div.addEventListener("click", (e) => {
            if (e.target.closest('a') && !opensLink(e)) e.preventDefault();
        });
        div.addEventListener("mousedown", (e) => {
            if (opensLink(e)) return;

            e.preventDefault();
            const pos = view.posAtDOM(div);
            if (pos !== null) {
                view.dispatch({
                    selection: { anchor: pos, head: pos },
                    scrollIntoView: true
                });
                view.focus();
            }
        });

        return div;
    }

    eq(other) {
        return this.data === other.data || this.getKey() === other.getKey();
    }

    getKey() { return this.key ??= JSON.stringify(this.data); }

    ignoreEvent() { return true; }
}

export class TextSpanWidget extends WidgetType {
    constructor(text, className) {
        super();
        this.text = text;
        this.className = className;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = this.className;
        span.textContent = this.text;
        return span;
    }

    eq(other) {
        return other.text === this.text && other.className === this.className;
    }

    ignoreEvent() {
        return false;
    }
}
