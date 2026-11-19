// Dynamic import keeps CHANGELOG.md out of the main bundle until Settings > About is expanded.
export async function loadChangelog() {
    return (await import('../../CHANGELOG.md?raw')).default;
}
