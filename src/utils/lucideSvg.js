// Builds lucide <svg> elements from icon data, for CodeMirror widgets and the export renderer (no React,
// no innerHTML). Names are the ones in CALLOUT_TYPES plus 'chevron-down'. Alias files such as
// `triangle-alert` re-export only the default, so each import points at the canonical file.
import { __iconData as pencil } from 'lucide-react/icons/pencil';
import { __iconData as clipboardList } from 'lucide-react/icons/clipboard-list';
import { __iconData as info } from 'lucide-react/icons/info';
import { __iconData as circleCheck } from 'lucide-react/icons/circle-check';
import { __iconData as flame } from 'lucide-react/icons/flame';
import { __iconData as circleAlert } from 'lucide-react/icons/circle-exclamation-point';
import { __iconData as check } from 'lucide-react/icons/check';
import { __iconData as circleHelp } from 'lucide-react/icons/circle-question-mark';
import { __iconData as triangleAlert } from 'lucide-react/icons/triangle-exclamation-point';
import { __iconData as octagonAlert } from 'lucide-react/icons/octagon-exclamation-point';
import { __iconData as x } from 'lucide-react/icons/x';
import { __iconData as zap } from 'lucide-react/icons/zap';
import { __iconData as bug } from 'lucide-react/icons/bug';
import { __iconData as list } from 'lucide-react/icons/list';
import { __iconData as quote } from 'lucide-react/icons/quote';
import { __iconData as chevronDown } from 'lucide-react/icons/chevron-down';

const ICONS = {
    'pencil': pencil, 'clipboard-list': clipboardList, 'info': info, 'circle-check': circleCheck,
    'flame': flame, 'circle-alert': circleAlert, 'check': check, 'circle-help': circleHelp,
    'triangle-alert': triangleAlert, 'octagon-alert': octagonAlert, 'x': x, 'zap': zap, 'bug': bug,
    'list': list, 'quote': quote, 'chevron-down': chevronDown,
};

const NS = 'http://www.w3.org/2000/svg';

export function lucideSvg(name, className) {
    const data = ICONS[name]?.node ? ICONS[name] : null;
    if (!data) return null; // lucide's __iconData is undocumented; a missing icon must not break rendering
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '1em');
    svg.setAttribute('height', '1em');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of data.node) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) if (k !== 'key') el.setAttribute(k, v);
        svg.appendChild(el);
    }
    return svg;
}
