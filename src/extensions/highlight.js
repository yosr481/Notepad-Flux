// `==text==` highlight. /g: callers matchAll it or copy it (new RegExp(HIGHLIGHT)) before exec loops, since exec mutates lastIndex.
export const HIGHLIGHT = /==(.*?)==/g;
