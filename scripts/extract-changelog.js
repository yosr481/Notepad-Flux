/* global process */
import fs from 'fs';
import path from 'path';

// Pull the body of the FIRST version section out of a Keep-a-Changelog file.
// Header format: "## [1.2.2] - 2026-02-25" — the separator may be a hyphen or an
// en/em dash with any run of spaces/tabs around it (CHANGELOG.md uses "—").
export function extractLatestNotes(changelog) {
    const regex = /## \[.*?\][ \t]*[-–—][ \t]*.*?\r?\n([\s\S]*?)(?=\r?\n## \[|$)/;
    const match = changelog.match(regex);
    return match && match[1] ? match[1].trim() : null;
}

// Run the file IO only when invoked as a script, not when imported by a test.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('extract-changelog.js');
if (invokedDirectly) {
    const changelogPath = path.resolve('CHANGELOG.md');
    const outputPath = path.resolve('release-notes.md');
    try {
        const notes = extractLatestNotes(fs.readFileSync(changelogPath, 'utf8'));
        if (notes) {
            fs.writeFileSync(outputPath, notes);
            console.log('Successfully extracted release notes to release-notes.md');
            console.log('Content:\n' + notes);
        } else {
            console.error('Could not find latest changelog entry.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error extracting changelog:', error);
        process.exit(1);
    }
}
