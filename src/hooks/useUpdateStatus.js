import { useEffect, useState } from 'react';

// The app update status pushed by main (Docs/internal/update-spec.md), or null in the web build.
export function useUpdateStatus() {
    const api = typeof window !== 'undefined' ? window.electronAPI?.updates : undefined;
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (!api) return undefined;
        let pushed = false;
        let live = true;
        const unsubscribe = api.onStatus((s) => {
            pushed = true;
            if (live) setStatus(s);
        });
        // A push that lands before this resolves is newer; keep it.
        Promise.resolve(api.getStatus()).then((s) => {
            if (live && !pushed) setStatus(s);
        }, () => { });
        return () => {
            live = false;
            unsubscribe?.();
        };
    }, [api]);

    return api ? status : null;
}
