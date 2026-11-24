import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// vitest blanks CSS imports, so read the raw files.
const root = path.resolve(__dirname, "../../..");
const css = fs
    .readFileSync(path.join(root, "src/styles/variables.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const themeSrc = fs.readFileSync(path.join(root, "src/theme.js"), "utf8");

function declsFor(selectorRe) {
    const out = {};
    const blockRe = new RegExp(selectorRe.source + "\\s*\\{([^}]*)\\}", "g");
    for (const m of css.matchAll(blockRe)) {
        for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
    }
    return out;
}
const lightDecls = declsFor(/:root/);
const darkOverrides = declsFor(/\[data-theme="dark"\]/);
const darkDecls = { ...lightDecls, ...darkOverrides };

function resolve(value, decls, seen = []) {
    const v = value.trim();
    const m = v.match(/^var\((--[\w-]+)\)$/);
    if (!m) return v;
    if (seen.includes(m[1])) throw new Error(`var() cycle at ${m[1]}`);
    if (!(m[1] in decls)) throw new Error(`undefined variable ${m[1]}`);
    return resolve(decls[m[1]], decls, [...seen, m[1]]);
}
function varColor(name, decls) {
    return resolve(`var(${name})`, decls);
}

function lum(hex) {
    expect(hex, `not a #rrggbb hex: ${hex}`).toMatch(/^#[0-9a-f]{6}$/i);
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// "Code Highlighting" block of fluxHighlightStyle: tag name -> css var
const codeBlock = themeSrc.slice(themeSrc.indexOf("// Code Highlighting"), themeSrc.indexOf("]);", themeSrc.indexOf("// Code Highlighting")));
const codeTags = [...codeBlock.matchAll(/tag:\s*([^,}]+?(?:\([^)]*\))?)\s*,\s*color:\s*"var\((--[\w-]+)\)"/g)].map((m) => ({
    tag: m[1].trim(),
    variable: m[2],
}));

describe("code highlighting contrast (WCAG AA 4.5:1 vs code-block background)", () => {
    it("parses the expected 12 code tags from theme.js", () => {
        expect(codeTags.map((t) => t.tag)).toEqual([
            "tags.keyword", "tags.operator", "tags.comment", "tags.string", "tags.regexp", "tags.number",
            "tags.bool", "tags.variableName", "tags.function(tags.variableName)", "tags.className",
            "tags.typeName", "tags.propertyName",
        ]);
    });

    for (const [theme, decls] of [["light", lightDecls], ["dark", darkDecls]]) {
        describe(theme, () => {
            const bg = () => varColor("--background-secondary", decls);
            for (const { tag, variable } of codeTags) {
                it(`${tag} (${variable}) >= 4.5`, () => {
                    const ratio = contrast(varColor(variable, decls), bg());
                    expect(ratio, `${theme} ${tag} ${variable}=${varColor(variable, decls)} on ${bg()} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
                });
            }
        });
    }
});

describe("dark theme overrides every --syntax-* variable", () => {
    const syntaxVars = Object.keys(lightDecls).filter((k) => k.startsWith("--syntax-"));
    it("finds syntax variables in :root", () => {
        expect(syntaxVars.length).toBeGreaterThan(0);
    });
    for (const v of syntaxVars) {
        it(`${v} defined in [data-theme="dark"]`, () => {
            expect(darkOverrides).toHaveProperty([v]);
        });
    }
});
