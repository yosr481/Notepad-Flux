import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { StateField } from "@codemirror/state";
import yaml from "js-yaml";
import { scanFrontMatter } from "./frontMatterSyntax";

const isObject = (v) => v !== null && typeof v === "object" && !(v instanceof Date);
const dateText = (d) => {
    const iso = d.toISOString();
    return d.getTime() % 86400000 === 0 ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
};
const scalarText = (v) => (v == null ? "" : v instanceof Date ? dateText(v) : String(v));

function rowOf(key, v) {
    if (v == null || v === "") return { key, kind: "empty", value: "" };
    if (v instanceof Date) return { key, kind: "date", value: dateText(v) };
    if (Array.isArray(v) && !v.some(isObject)) return { key, kind: "list", value: v.map(scalarText) };
    if (isObject(v)) return { key, kind: "yaml", value: yaml.dump(v, { flowLevel: 0 }).trim() };
    const kind = typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "text";
    return { key, kind, value: String(v) };
}

// -> { rows: [{ key, kind, value }] } | { error }. Never throws.
// ponytail: integer-like keys ("2:") come first, js-yaml returns a plain object; fix needs an AST, not worth it.
export function propertiesFromYaml(yamlText) {
    let data;
    try {
        data = yaml.load(yamlText);
    } catch (e) {
        return { error: String(e.message).split("\n")[0] };
    }
    if (data == null) return { rows: [] };
    if (!isObject(data) || Array.isArray(data)) return { error: "Front matter must be a list of key: value pairs" };
    return { rows: Object.entries(data).map(([k, v]) => rowOf(k, v)) };
}

const el = (tag, className, text) => {
    const e = document.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
};

class PropertiesWidget extends WidgetType {
    constructor(yamlText) {
        super();
        this.yamlText = yamlText;
    }

    toDOM() {
        const box = el("div", "cm-properties");
        const result = propertiesFromYaml(this.yamlText);
        if (result.error !== undefined) {
            box.classList.add("cm-properties-error");
            box.append(el("div", "cm-properties-header", "Properties"), el("div", "cm-properties-message", result.error));
            box.append(el("pre", "cm-properties-raw", this.yamlText));
            return box;
        }
        box.append(el("div", "cm-properties-header", "Properties"));
        if (!result.rows.length) box.append(el("div", "cm-properties-empty", "No properties"));
        for (const { key, kind, value } of result.rows) {
            const row = el("div", "cm-property");
            const val = el("span", "cm-property-value");
            val.dir = "auto";
            if (kind === "list") val.append(...value.map((item) => el("span", "cm-property-chip", item)));
            else val.textContent = value;
            row.append(el("span", "cm-property-key", key), val);
            box.append(row);
        }
        return box;
    }

    eq(other) {
        return other.yamlText === this.yamlText;
    }

    ignoreEvent() {
        return false;
    }
}

const FENCE = /^\uFEFF?---[ \t]*$/, CLOSER = /^(?:---|\.\.\.)[ \t]*$/;
// ponytail: a closer more than MAX_LINES down is not front matter here, so an unclosed fence never
// rescans a huge document per keystroke. Raise it (or cache by changed range) if that bites.
const MAX_LINES = 500;

// Reads only the head of the document, up to the first closer line; scanFrontMatter stays the one rule.
function headScan(doc) {
    if (!FENCE.test(doc.line(1).text)) return null;
    const last = Math.min(doc.lines, MAX_LINES);
    for (let n = 2; n <= last; n++) {
        const line = doc.line(n);
        if (CLOSER.test(line.text)) return scanFrontMatter(doc.sliceString(0, line.to));
    }
    return null;
}

const fenceMark = Decoration.mark({ class: "cm-faint-syntax" });
const rawLine = Decoration.line({ class: "cm-frontmatter-line" });

function buildValue(state) {
    const fm = headScan(state.doc);
    return fm ? withSelection({ fm, text: state.doc.sliceString(fm.contentFrom, fm.contentTo) }, state) : { fm: null, decos: Decoration.none };
}

function rawDecos(doc, fm) {
    const first = doc.lineAt(fm.from), last = doc.lineAt(fm.to);
    const ranges = [fenceMark.range(fm.from, first.to), fenceMark.range(last.from, fm.to)];
    for (let n = first.number; n <= last.number; n++) ranges.push(rawLine.range(doc.line(n).from));
    return Decoration.set(ranges, true);
}

// The only selection input: does it touch the block. Same decoration set while that stays the same.
function withSelection(value, state) {
    const { fm } = value;
    const touched = state.selection.ranges.some((r) => r.from <= fm.to && r.to >= fm.from);
    if (value.decos && touched === value.touched) return value;
    const decos = touched ? rawDecos(state.doc, fm)
        : Decoration.set([Decoration.replace({ widget: new PropertiesWidget(value.text), block: true }).range(fm.from, fm.to)]);
    return { ...value, touched, decos };
}

const frontMatterField = StateField.define({
    create: buildValue,
    update(value, tr) {
        if (tr.docChanged) return buildValue(tr.state);
        return tr.selection && value.fm ? withSelection(value, tr.state) : value;
    },
    provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

const frontMatterClick = EditorView.domEventHandlers({
    mousedown(event, view) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        if (!(event.target instanceof Element) || !event.target.closest(".cm-properties")) return false;
        const { fm } = view.state.field(frontMatterField);
        if (!fm) return false;
        const anchor = fm.contentTo > fm.contentFrom ? fm.contentFrom : view.state.doc.line(1).to;
        view.dispatch({ selection: { anchor } });
        view.focus();
        event.preventDefault();
        return true;
    },
});

export const frontMatterPreview = [frontMatterField, frontMatterClick];
