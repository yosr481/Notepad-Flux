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

        // The box shows the doc, never its own native toggle (else screen and file can disagree).
        input.addEventListener("click", (e) => e.preventDefault());
        input.addEventListener("mousedown", (e) => {
            e.preventDefault(); // Prevent default focus change issues
            // The widget replaces exactly the TaskMarker "[ ]", so its start is the "[".
            // Works whatever precedes the bullet: "> ", "+ ", "1. ".
            const pos = view.posAtDOM(input);
            if (pos === null) return;
            const marker = view.state.doc.sliceString(pos, pos + 3);
            if (!/^\[[ xX]\]$/.test(marker)) return;
            view.dispatch({
                changes: { from: pos + 1, to: pos + 2, insert: marker[1] === ' ' ? 'x' : ' ' }
            });
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
        this.key = JSON.stringify(data);
    }

    toDOM(view) {
        const div = document.createElement("div");
        div.className = "cm-table-widget";
        div.append(tableDOM(this.data, view));

        div.addEventListener("mousedown", (e) => {
            // Allow clicking links inside the table
            if (e.target.closest('a')) return;

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

    eq(other) { return other.key === this.key; }

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
