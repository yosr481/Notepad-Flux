import { WidgetType, Decoration } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { makeDebouncedDecorationPlugin } from "./decorationPlugin";
import { resolveLinkDefs, normalizeLabel } from "./linkDefs";

class LRUCache {
    constructor(limit = 100) {
        this.limit = limit;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }
}

const globalImageCache = new LRUCache(100);
const pendingRequests = new Map();

const brokenImageTemplate = (() => {
    const template = document.createElement("template");
    template.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cm-broken-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><line x1="3" x2="21" y1="3" y2="21"/></svg>
        <span class="cm-broken-text"></span>
    `;
    return template;
})();

function loadImage(url) {
    const cached = globalImageCache.get(url);
    if (cached) return Promise.resolve(cached);

    if (pendingRequests.has(url)) return pendingRequests.get(url);

    const promise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            img.decode?.().catch(() => { }).finally(() => {
                const data = { status: 'loaded', element: img };
                globalImageCache.set(url, data);
                pendingRequests.delete(url);
                resolve(data);
            });
        };
        img.onerror = () => {
            const data = { status: 'error', element: null };
            globalImageCache.set(url, data);
            pendingRequests.delete(url);
            resolve(data);
        };
        img.src = url;
    });

    pendingRequests.set(url, promise);
    return promise;
}

class ImageWidget extends WidgetType {
    constructor(url, alt, active) {
        super();
        this.url = url;
        this.alt = alt;
        this.active = active;
    }

    toDOM(view) {
        const container = document.createElement("span");
        container.className = this.active ? "cm-image-container cm-active" : "cm-image-container cm-inactive";

        const cached = globalImageCache.get(this.url);

        if (cached) {
            this.renderState(container, cached);
        } else {
            container.classList.add("cm-image-loading");

            loadImage(this.url).then((data) => {
                if (container.isConnected) {
                    container.classList.remove("cm-image-loading");
                    this.renderState(container, data);
                }
            });
        }
        return container;
    }

    renderState(container, data) {
        container.textContent = "";
        if (data.status === 'loaded') {
            const img = data.element.cloneNode(true);
            img.className = "cm-image";
            img.alt = this.alt;

            container.appendChild(img);
            // Update container class to maintain active/inactive state
            container.className = this.active ? "cm-image-container cm-active" : "cm-image-container cm-inactive";
        } else {
            const content = brokenImageTemplate.content.cloneNode(true);
            content.querySelector(".cm-broken-text").textContent = this.alt || "Image not found";
            container.appendChild(content);
            // Update container class for broken image
            container.className = this.active ? "cm-image-broken cm-active" : "cm-image-broken cm-inactive";
        }
    }

    eq(other) {
        return other.url === this.url && other.alt === this.alt && other.active === this.active;
    }
}

const imageMatcher = /!\[(.*?)\]\(([^"\s)]+)(?:\s+[^)]*)?\)/g;
const imageRefFullMatcher = /!\[([^\]]*)\]\[([^\]]*)\]/g;
const imageRefShortcutMatcher = /!\[([^\]]+)\](?!\[|\()/g;

function computeImageDecorations(view) {
    const builder = new RangeSetBuilder();
    const { from: selFrom, to: selTo } = view.state.selection.main;
    const defs = resolveLinkDefs(view.state);

    for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);

        // Inline images: ![alt](url)
        imageMatcher.lastIndex = 0;
        let match;

        while ((match = imageMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            const isCursorInside = (selFrom <= end) && (selTo >= start);

            if (!isCursorInside) {
                builder.add(start, end, Decoration.replace({
                    widget: new ImageWidget(match[2], match[1], false),
                    inclusive: false
                }));
            } else {
                builder.add(end, end, Decoration.widget({
                    widget: new ImageWidget(match[2], match[1], true),
                    side: 1
                }));
            }
        }

        // Reference-style images: ![alt][id] or ![id][]
        imageRefFullMatcher.lastIndex = 0;
        while ((match = imageRefFullMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            const alt = match[1];
            const label = match[2] || alt;  // If empty label, use alt
            const normalizedLabel = normalizeLabel(label);
            const def = defs.get(normalizedLabel);

            if (def) {
                const isCursorInside = (selFrom <= end) && (selTo >= start);
                if (!isCursorInside) {
                    builder.add(start, end, Decoration.replace({
                        widget: new ImageWidget(def.url, alt, false),
                        inclusive: false
                    }));
                } else {
                    builder.add(end, end, Decoration.widget({
                        widget: new ImageWidget(def.url, alt, true),
                        side: 1
                    }));
                }
            }
        }

        // Shortcut reference images: ![id]
        imageRefShortcutMatcher.lastIndex = 0;
        while ((match = imageRefShortcutMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            const alt = match[1];
            const normalizedLabel = normalizeLabel(alt);
            const def = defs.get(normalizedLabel);

            if (def) {
                const isCursorInside = (selFrom <= end) && (selTo >= start);
                if (!isCursorInside) {
                    builder.add(start, end, Decoration.replace({
                        widget: new ImageWidget(def.url, alt, false),
                        inclusive: false
                    }));
                } else {
                    builder.add(end, end, Decoration.widget({
                        widget: new ImageWidget(def.url, alt, true),
                        side: 1
                    }));
                }
            }
        }
    }
    return builder.finish();
}

export const imagePreview = makeDebouncedDecorationPlugin({ compute: computeImageDecorations });