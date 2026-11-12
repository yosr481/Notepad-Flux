import { useEffect, useRef } from 'react';
import { fileSystem } from '../utils/fileSystem';
import { openIntoTab } from '../utils/openIntoTab';

// Open the files main queued from the command line (OS "open with", a terminal).
// Main drains its queue on each take, so every file comes back once.
export async function openLaunchFiles({ createTab, addRecentFile, showToast }) {
    let files;
    try {
        files = await fileSystem.takeLaunchFiles();
    } catch (err) {
        showToast?.(`Could not open files: ${err?.message || 'unknown error'}`);
        return;
    }
    for (const f of files) {
        if (f.error) showToast?.(`Could not open "${f.name}": ${f.error}`);
        else openIntoTab({ name: f.name, content: f.content, handle: f.handle }, { createTab, addRecentFile });
    }
}

export function useLaunchFiles(deps) {
    // Latest callbacks through a ref: drain once on mount, not on every new callback identity.
    const depsRef = useRef(deps);
    useEffect(() => { depsRef.current = deps; }); // runs before the mount effect below
    useEffect(() => {
        const run = () => openLaunchFiles(depsRef.current);
        run();
        return window.electronAPI?.onLaunchFiles?.(run);
    }, []);
}
