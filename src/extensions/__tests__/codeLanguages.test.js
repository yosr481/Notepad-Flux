import { languages } from "@codemirror/language-data";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";

// Module under test — does not exist yet, so this file must fail to load.
import codeLanguagesDefault, {
  codeLanguages,
  isMarkdownLanguage,
} from "../codeLanguages.js";

// ---------------------------------------------------------------------------
// Pinned conventions (see report):
//  * isMarkdownLanguage(desc): true iff
//      - String(desc.name) case-insensitively === "markdown" or "mdx", OR
//      - desc.alias (array, missing => treated as []) contains, case-insensitively,
//        any of "md" / "markdown" / "mdx".
//    Null / undefined / non-object desc => false (never throws).
//  * codeLanguages: the @codemirror/language-data `languages` array with every
//    descriptor matching isMarkdownLanguage removed. Order of the survivors is
//    preserved. It is BOTH the default export and the named `codeLanguages`
//    export, and the two are the SAME array reference.
//  * Integration probing: @lezer/markdown mounts a nested language parse as an
//    *overlay* mount. Overlay mounts are invisible to Tree.iterate() and to a
//    plain TreeCursor descent (verified). The only reliable observation is
//    tree.resolveInner(pos, 1) followed by walking `.parent`. So the nesting
//    tests assert on that ancestor-name chain at positions inside the fence
//    body, not on an iterate() walk.
//  * The nested parse only resolves synchronously once the LanguageDescription's
//    `.support` is loaded. Tests run against a bare EditorState (no EditorView
//    in jsdom), so beforeAll() preloads the Markdown + JavaScript descriptors.
// ---------------------------------------------------------------------------

const MD_FENCE = [
  "```markdown",
  "# not a heading",
  "**not bold**",
  "> not a quote",
  "```",
  "",
].join("\n");

const JS_FENCE = ["```javascript", "const x = 1", "```", ""].join("\n");

const PLAIN_FENCE = ["```", "# x", "```", ""].join("\n");

const makeState = (doc, codeLangs) =>
  EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, codeLanguages: codeLangs })],
  });

/** innermost-first list of ancestor node names at `pos` */
const ancestorNames = (state, pos) => {
  const len = state.doc.length;
  const tree = ensureSyntaxTree(state, len, 10000) ?? syntaxTree(state);
  const names = [];
  for (let n = tree.resolveInner(pos, 1); n; n = n.parent) names.push(n.name);
  return names;
};

beforeAll(async () => {
  await Promise.all(
    ["Markdown", "JavaScript"].map((name) =>
      languages.find((l) => l.name === name).load()
    )
  );
});

describe("isMarkdownLanguage", () => {
  it("is true for the language-data Markdown descriptor", () => {
    const md = languages.find((l) => l.name === "Markdown");
    expect(isMarkdownLanguage(md)).toBe(true);
  });

  it("is true for a Markdown-named and an MDX-named descriptor (name match, case-insensitive)", () => {
    // MDX is not shipped in the installed @codemirror/language-data, so the
    // MDX case is pinned with a synthetic descriptor of the documented shape.
    expect(isMarkdownLanguage({ name: "Markdown", alias: [] })).toBe(true);
    expect(isMarkdownLanguage({ name: "markdown", alias: [] })).toBe(true);
    expect(isMarkdownLanguage({ name: "MDX", alias: ["mdx"] })).toBe(true);
    expect(isMarkdownLanguage({ name: "mdx", alias: [] })).toBe(true);
  });

  it("is true on alias match alone (md / markdown / mdx, case-insensitive)", () => {
    expect(isMarkdownLanguage({ name: "Something", alias: ["md"] })).toBe(true);
    expect(isMarkdownLanguage({ name: "Something", alias: ["MARKDOWN"] })).toBe(
      true
    );
    expect(isMarkdownLanguage({ name: "Something", alias: ["MdX"] })).toBe(true);
  });

  it("is false for JavaScript, Python, JSON, HTML descriptors", () => {
    for (const name of ["JavaScript", "Python", "JSON", "HTML"]) {
      const desc = languages.find((l) => l.name === name);
      expect(desc, `${name} descriptor present`).toBeTruthy();
      expect(isMarkdownLanguage(desc), name).toBe(false);
    }
  });

  it("is false for a descriptor whose alias merely contains the substring 'md' but not as a whole token", () => {
    // 'cmd', 'mdx-ish' etc must not match — the predicate matches whole aliases.
    expect(isMarkdownLanguage({ name: "CMD", alias: ["cmd"] })).toBe(false);
    expect(isMarkdownLanguage({ name: "X", alias: ["amd"] })).toBe(false);
  });

  it("is false (never throws) for null / undefined / junk input", () => {
    expect(isMarkdownLanguage(null)).toBe(false);
    expect(isMarkdownLanguage(undefined)).toBe(false);
    expect(isMarkdownLanguage({})).toBe(false);
    expect(isMarkdownLanguage({ name: "X" })).toBe(false); // missing alias
  });
});

describe("codeLanguages filtered array", () => {
  const removedCount = languages.filter(isMarkdownLanguage).length;

  it("removes at least one descriptor (sanity on the fixture)", () => {
    expect(removedCount).toBeGreaterThanOrEqual(1);
  });

  it("contains no markdown/mdx descriptor", () => {
    expect(codeLanguages.some(isMarkdownLanguage)).toBe(false);
  });

  it("has length === languages.length minus the markdown/mdx count", () => {
    expect(codeLanguages.length).toBe(languages.length - removedCount);
  });

  it("still contains the JavaScript descriptor", () => {
    expect(codeLanguages.find((l) => l.name === "JavaScript")).toBeTruthy();
  });

  it("preserves the relative order of the surviving descriptors", () => {
    const expected = languages
      .filter((l) => !isMarkdownLanguage(l))
      .map((l) => l.name);
    expect(codeLanguages.map((l) => l.name)).toEqual(expected);
  });

  it("is exported as both the default and the named `codeLanguages`, same reference", () => {
    expect(codeLanguagesDefault).toBe(codeLanguages);
  });
});

describe("nested parsing inside ```markdown fences", () => {
  it("BUG REPRODUCTION: with the raw languages list, a ```markdown fence body parses into real markdown nodes", () => {
    const state = makeState(MD_FENCE, languages);
    expect(
      ancestorNames(state, MD_FENCE.indexOf("not a heading") + 2)
    ).toContain("ATXHeading1");
    expect(ancestorNames(state, MD_FENCE.indexOf("not bold") + 2)).toContain(
      "StrongEmphasis"
    );
    expect(ancestorNames(state, MD_FENCE.indexOf("not a quote") + 2)).toContain(
      "Blockquote"
    );
  });

  it("with the filtered list, the ```markdown fence body stays literal CodeText", () => {
    const state = makeState(MD_FENCE, codeLanguages);

    const headingChain = ancestorNames(
      state,
      MD_FENCE.indexOf("not a heading") + 2
    );
    expect(headingChain).not.toContain("ATXHeading1");
    expect(headingChain).toContain("CodeText");

    const boldChain = ancestorNames(state, MD_FENCE.indexOf("not bold") + 2);
    expect(boldChain).not.toContain("StrongEmphasis");
    expect(boldChain).toContain("CodeText");

    const quoteChain = ancestorNames(state, MD_FENCE.indexOf("not a quote") + 2);
    expect(quoteChain).not.toContain("Blockquote");
    expect(quoteChain).toContain("CodeText");
  });
});

describe("other fences are unaffected by the filter", () => {
  it("a ```javascript fence still resolves its language (JS nodes present)", () => {
    const state = makeState(JS_FENCE, codeLanguages);
    const chain = ancestorNames(state, JS_FENCE.indexOf("const x") + 2);
    // @lezer/javascript top node is `Script`; the const lands in a declaration.
    expect(chain).toContain("Script");
    expect(chain).not.toContain("CodeText");
    expect(chain).not.toContain("ATXHeading1");
  });

  it("a plain ``` fence with `# x` inside stays CodeText, no heading, no nested language", () => {
    const state = makeState(PLAIN_FENCE, codeLanguages);
    const chain = ancestorNames(state, PLAIN_FENCE.indexOf("# x") + 2);
    expect(chain).toContain("CodeText");
    expect(chain).not.toContain("ATXHeading1");
    expect(chain).not.toContain("Script");
  });
});
