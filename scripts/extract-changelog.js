import fs from 'fs';
import path from 'path';

const changelogPath = path.resolve('CHANGELOG.md');
const outputPath = path.resolve('release-notes.md');

try {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    
    // Match the first version section: everything between the first ## and the second ## (or end of file)
    // Format: ## [1.2.2] - 2026-02-25
    const regex = /## \[.*?\] - .*?\n([\s\S]*?)(?=\n## \[|$)/;
    const match = changelog.match(regex);
    
    if (match && match[1]) {
        const notes = match[1].trim();
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
