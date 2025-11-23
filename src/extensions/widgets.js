import { WidgetType } from "@codemirror/view";

export class BulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-bullet";
        span.textContent = "•";
        return span;
    }

    eq(other) { return true; }

    ignoreEvent() { return true; }
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
        // Prevent default to avoid cursor jumping, handle click via editor transaction if needed
        // For now, let's just let it be visual or handle mousedown
        input.addEventListener("mousedown", (e) => {
            // Logic to toggle markdown would go here, but for now just stop propagation
            // e.preventDefault(); 
        });
        return input;
    }

    eq(other) { return other.checked === this.checked; }
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
