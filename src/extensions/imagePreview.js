import { WidgetType, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// --- 1. Global Cache & Templates ---

// Cache the broken image template
const brokenImageTemplate = (() => {
    const template = document.createElement("template");
    template.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cm-broken-icon"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><line x1="3" x2="21" y1="3" y2="21"/></svg>
        <span class="cm-broken-text"></span>
    `;
    return template;
})();

// Global cache to store image status and data
// Key: URL string
// Value: { status: 'loaded' | 'error', element: HTMLImageElement | null }
const imageCache = new Map();

// Track active promises to prevent duplicate network requests for the same URL
const pendingRequests = new Map();

// Helper to load an image once and share the result
function loadImage(url) {
    if (imageCache.has(url)) return Promise.resolve(imageCache.get(url));
    if (pendingRequests.has(url)) return pendingRequests.get(url);

    const promise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const data = { status: 'loaded', element: img };
            imageCache.set(url, data);
            pendingRequests.delete(url);
            resolve(data);
        };
        img.onerror = () => {
            const data = { status: 'error', element: null };
            imageCache.set(url, data);
            pendingRequests.delete(url);
            resolve(data); // Resolve even on error so we can render the broken icon
        };
        img.src = url;
    });

    pendingRequests.set(url, promise);
    return promise;
}

// --- 2. Optimized Widget ---

class ImageWidget extends WidgetType {
    constructor(url, alt) {
        super();
        this.url = url;
        this.alt = alt;
    }

    toDOM(view) {
        const container = document.createElement("span");
        container.className = "cm-image-container"; // Default container class

        // Check cache synchronously first
        const cached = imageCache.get(this.url);

        if (cached) {
            // CASE A: We already know the result (Success or Fail)
            this.renderState(container, cached);
        } else {
            // CASE B: First time seeing this URL.
            // 1. Do NOT show broken icon yet. Show loading state (empty or spinner).
            container.classList.add("cm-image-loading");

            // 2. Start load (or hook into existing pending request)
            loadImage(this.url).then((data) => {
                // Ensure the container is still in the DOM before updating
                if (container.isConnected) {
                    container.classList.remove("cm-image-loading");
                    this.renderState(container, data);
                }
            });
        }

        return container;
    }

    renderState(container, data) {
        container.textContent = ""; // Clear loading state

        if (data.status === 'loaded') {
            // Clone the cached image node so we don't move the original DOM element
            const img = data.element.cloneNode(true);
            img.className = "cm-image";
            img.alt = this.alt;
            img.title = this.alt;
            container.appendChild(img);
            container.className = "cm-image-container";
        } else {
            // Render broken placeholder
            const content = brokenImageTemplate.content.cloneNode(true);
            const textSpan = content.querySelector(".cm-broken-text");
            textSpan.textContent = this.alt || "Image not found";
            container.appendChild(content);
            container.className = "cm-image-broken";
        }
    }

    eq(other) {
        return other.url === this.url && other.alt === this.alt;
    }

    ignoreEvent() {
        return false;
    }
}

// --- 3. View Plugin (Unchanged logic, just context) ---

const imageMatcher = /!\[(.*?)\]\((.*?)\)/g;

export const imagePreview = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.computeDecorations(view);
        this.lastCursorImageRange = null;
    }

    update(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.computeDecorations(update.view);
            this.lastCursorImageRange = this.findImageRangeAtCursor(update.view);
            return;
        }

        if (update.selectionSet) {
            const currentImageRange = this.findImageRangeAtCursor(update.view);
            const rangeChanged =
                (this.lastCursorImageRange === null) !== (currentImageRange === null) ||
                (this.lastCursorImageRange && currentImageRange &&
                    (this.lastCursorImageRange.start !== currentImageRange.start ||
                        this.lastCursorImageRange.end !== currentImageRange.end));

            if (rangeChanged) {
                this.decorations = this.computeDecorations(update.view);
                this.lastCursorImageRange = currentImageRange;
            }
        }
    }

    findImageRangeAtCursor(view) {
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        const { from: selFrom, to: selTo } = view.state.selection.main;

        imageMatcher.lastIndex = 0;
        let match;
        while ((match = imageMatcher.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            if ((selFrom <= end) && (selTo >= start)) {
                return { start, end };
            }
        }
        return null;
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