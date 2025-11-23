import { WidgetType } from "@codemirror/view";

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
            // We look for - [ ] or - [x]
            const match = lineText.match(/^(\s*[-*] )\[([ x])\]/);

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
    constructor(htmlContent) {
        super();
        this.htmlContent = htmlContent;
    }

    toDOM(view) {
        const div = document.createElement("div");
        div.className = "cm-table-widget";
        div.innerHTML = this.htmlContent;

        div.addEventListener("mousedown", (e) => {
            // Allow clicking links inside the table
            if (e.target.tagName === 'A') return;

            e.preventDefault();
            const pos = view.posAtDOM(div);
            if (pos !== null) {
                view.dispatch({
                    selection: { anchor: pos, head: pos },
                    scrollIntoView: true
                });
            }
        });

        return div;
    }

    eq(other) { return other.htmlContent === this.htmlContent; }

    ignoreEvent() { return true; }
}
