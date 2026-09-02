// Shared cursor/selection helper utilities for decoration plugins

export const isCursorTouching = (selection, from, to) => {
    return selection.ranges.some(range => range.from <= to && range.to >= from);
};

export const isCursorOnLine = (selection, doc, from) => {
    const line = doc.lineAt(from);
    return selection.ranges.some(range => range.from <= line.to && range.to >= line.from);
};
