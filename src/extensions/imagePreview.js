import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// --- 1. LRU Cache Implementation ---
// This ensures we don't crash the browser with infinite images in a long session.
class LRUCache {
    constructor(limit = 100) {
        this.limit = limit;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        // Refresh item: delete and re-add to make it the "most recently used"
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            // Evict the oldest item (first key in Map)
            this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }
}

// --- 2. Global State ---

// Limit to 100 active images in memory (adjust based on your needs)
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
    // 1. Check LRU Cache
    const cached = globalImageCache.get(url);
    if (cached) return Promise.resolve(cached);

    // 2. Check Pending Requests (Deduplication)
    if (pendingRequests.has(url)) return pendingRequests.get(url);

    // 3. Fetch
    const promise = new Promise((resolve) => {
        const img = new Image();

        // Important: Decode image before resolving to prevent UI freeze on large images
        img.decode().then(() => {
            const data = { status: 'loaded', element: img };
            globalImageCache.set(url, data);
            pendingRequests.delete(url);
            resolve(data);
        }).catch(() => {
            // Decode failed or load failed
            const data = { status: 'error', element: null };
            globalImageCache.set(url, data);
            pendingRequests.delete(url);
            resolve(data);
        });

        img.src = url;
    });

    pendingRequests.set(url, promise);
    return promise;
}

// --- 3. Widget ---

class ImageWidget extends WidgetType {
    constructor(url, alt) {
        super();
        this.url = url;
        this.alt = alt;
    }

    toDOM(view) {
        const container = document.createElement("span");
        container.className = "cm-image-container";

        // Synchronous check
        const cached = globalImageCache.get(this.url);

        if (cached) {
            this.renderState(container, cached);
        } else {
            // Loading state
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
            // cloneNode(true) is very fast and lightweight
            const img = data.element.cloneNode(true);
            img.className = "cm-image";
            img.alt = this.alt;
            container.appendChild(img);
            container.className = "cm-image-container";
        } else {
            const content = brokenImageTemplate.content.cloneNode(true);
            content.querySelector(".cm-broken-text").textContent = this.alt || "Image not found";
            container.appendChild(content);
            container.className = "cm-image-broken";
        }
    }

    eq(other) {
        return other.url === this.url && other.alt === this.alt;
    }
}

// --- 4. View Plugin (Standard) ---

const imageMatcher = /!\[(.*?)\]\((.*?)\)/g;

export const imagePreview = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.computeDecorations(view);
        this.lastCursorImageRange = null;
    }

    update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.computeDecorations(update.view);
        }
    }

    computeDecorations(view) {
        const builder = new RangeSetBuilder();
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        const { from: selFrom, to: selTo } = view.state.selection.main;

        imageMatcher.lastIndex = 0;
        let match;
        while ((match = imageMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            const isCursorInside = (selFrom <= end) && (selTo >= start);

            if (!isCursorInside) {
                builder.add(start, end, Decoration.replace({
                    widget: new ImageWidget(match[2], match[1]),
                    inclusive: false
                }));
            } else {
                builder.add(end, end, Decoration.widget({
                    widget: new ImageWidget(match[2], match[1]),
                    side: 1
                }));
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});