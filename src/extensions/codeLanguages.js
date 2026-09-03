import { languages } from "@codemirror/language-data";

/**
 * Check if a language descriptor matches markdown or mdx.
 *
 * True iff:
 *  - String(desc.name) case-insensitively equals "markdown" or "mdx", OR
 *  - desc.alias (array; missing => []) contains a whole token (case-insensitive)
 *    equal to "md", "markdown", or "mdx"
 *
 * Never throws on null/undefined/non-object/alias-less input; returns false.
 */
export function isMarkdownLanguage(desc) {
  if (!desc || typeof desc !== "object") {
    return false;
  }

  const name = String(desc.name ?? "").toLowerCase();
  if (name === "markdown" || name === "mdx") {
    return true;
  }

  const aliases = Array.isArray(desc.alias) ? desc.alias : [];
  const mdAliases = ["md", "markdown", "mdx"];
  return aliases.some((alias) =>
    mdAliases.includes(String(alias).toLowerCase())
  );
}

/**
 * Filtered list of @codemirror/language-data languages,
 * with every markdown/mdx descriptor removed.
 * Survivor order is preserved.
 * Exported as both the default and named export (same reference).
 */
export const codeLanguages = languages.filter((lang) => !isMarkdownLanguage(lang));

export default codeLanguages;
