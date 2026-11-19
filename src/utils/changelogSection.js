// Body of the `## [version] — date` section of a Keep-a-Changelog file, trimmed; null if absent/empty/bad input.
// Matches the version literally (no regex built from it). `[Unreleased]` has no separator, so it never matches.
export function changelogSection(markdown, version) {
    if (typeof markdown !== 'string' || typeof version !== 'string' || !markdown || !version || version === 'Unreleased') return null;
    const head = `## [${version}]`;
    const lines = markdown.split('\n');
    const start = lines.findIndex((l) => l.startsWith(head) && /^[ \t]*[-–—]/.test(l.slice(head.length)));
    if (start < 0) return null;
    let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['));
    if (end < 0) end = lines.length;
    return lines.slice(start + 1, end).join('\n').trim() || null;
}
