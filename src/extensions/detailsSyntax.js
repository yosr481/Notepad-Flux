import { nodesOf } from "./nodeIndex";
import { decodeAttrEntities } from "./entities";

const OPENING = /^ {0,3}<details(\s[^>]*)?>/i;
const SUMMARY = /<summary(?:\s[^>]*)?>(.*?)<\/summary>/i;
const isClosing = (text) => text.trim().toLowerCase() === "</details>";

// Attribute named `open` only: quoted values are dropped first, `-` / letters before it disqualify.
const hasOpenAttr = (attrs) => /(^|\s)open(\s|=|$)/i.test(attrs.replace(/"[^"]*"|'[^']*'/g, ""));

const labelOf = (inner) => decodeAttrEntities(inner.replace(/<[^>]*>/g, "")).trim() || "Details";

// -> [{ from, headerTo, label, open, bodyFrom, bodyTo, closeFrom, closeTo }], outer before inner. Spec: Docs/internal/details-spec.md.
export function findDetails(state) {
    const doc = state.doc;
    const stack = [];
    const regions = [];
    for (const { from, to, node } of nodesOf(state, "HTMLBlock")) {
        if (node.parent?.name !== "Document") continue;
        const lines = [];
        for (let l = doc.lineAt(from); ; l = doc.line(l.number + 1)) {
            lines.push(l);
            if (l.to >= to) break;
        }
        lines.forEach((line, i) => {
            const m = OPENING.exec(line.text);
            if (m) {
                if (/<\/details\s*>/i.test(line.text.slice(m[0].length))) return; // one-line form stays source
                let headerLine = line, summary = SUMMARY.exec(line.text);
                for (let j = i + 1; !summary && j < lines.length && !OPENING.test(lines[j].text) && !isClosing(lines[j].text); j++) {
                    if ((summary = SUMMARY.exec(lines[j].text))) headerLine = lines[j];
                }
                stack.push({ from: line.from, headerTo: headerLine.to, headerNumber: headerLine.number, label: summary ? labelOf(summary[1]) : "Details", open: hasOpenAttr(m[1] ?? "") });
            } else if (isClosing(line.text) && stack.length) {
                const { headerNumber, ...r } = stack.pop();
                const empty = line.number === headerNumber + 1;
                regions.push({
                    ...r,
                    bodyFrom: empty ? line.from : doc.line(headerNumber + 1).from,
                    bodyTo: empty ? r.headerTo : doc.line(line.number - 1).to,
                    closeFrom: line.from,
                    closeTo: line.to,
                });
            }
        });
    }
    return regions.sort((a, b) => a.from - b.from);
}
