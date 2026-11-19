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

        input.addEventListener("mousedown", (e) => {
            e.preventDefault(); // Prevent default focus change issues
            const pos = view.posAtDOM(input);
            if (pos === null) return;

            // Find the line at this position
            const line = view.state.doc.lineAt(pos);
            const lineText = line.text;

            // Find the checkbox pattern in the line
            // We look for - [ ] or - [x] or - [X] or * [ ] etc.
            const match = lineText.match(/^(\s*[-*] )\[([ xX])\]/);

            if (match) {
                const prefix = match[1];
                const currentStatus = match[2];
                const newStatus = currentStatus === ' ' ? 'x' : ' ';

                // Calculate position of the character to replace
                // line.from + prefix.length + 1 (the character inside brackets)
                const charPos = line.from + prefix.length + 1;

                view.dispatch({
                    changes: { from: charPos, to: charPos + 1, insert: newStatus }
                });
            }
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
