// MathJax setup. Heavy: only ever loaded through the dynamic import in math.js.
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/js/svg.js';

// The font loads some glyph ranges (\mathbb, fraktur, big delimiters...) on demand.
// Bundle each as its own lazy chunk and hand MathJax the matching one by file name.
const fontRanges = import.meta.glob('/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js');
const rangeByName = new Map(Object.entries(fontRanges).map(([path, load]) => [path.split('/').pop(), load]));
mathjax.asyncLoad = (file) => {
    const load = rangeByName.get(String(file).split('/').pop());
    return load ? load() : Promise.reject(new Error(`MathJax font range not bundled: ${file}`));
};

// \ce arrows and bonds are private-use glyphs of a separate font extension (the -mhchem variant).
MathJaxNewcmFont.addExtension(MathJaxMhchemFontExtension);

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// No 'html' (\href, \class, \style, \cssId, \data), 'require' or 'autoload': they add links,
// attributes or fetch code. fontCache 'none' keeps glyphs inline, so there is no <use href>.
const PACKAGES = ['base', 'ams', 'newcommand', 'noundefined', 'boldsymbol', 'color', 'cancel', 'mhchem', 'braket'];
const output = new SVG({ fontCache: 'none', fontData: MathJaxNewcmFont });

// TeX -> raw <svg> markup (the mjx-container wrapper dropped). Not sanitized here.
export async function texToSvg(tex, display) {
    // A fresh TeX input per formula (~1 ms): \newcommand macros live in the input jax, and
    // sharing one would make a formula's look depend on what was rendered before it.
    const doc = mathjax.document('', { InputJax: new TeX({ packages: PACKAGES }), OutputJax: output });
    const container = await doc.convertPromise(tex, { display });
    return adaptor.outerHTML(adaptor.firstChild(container));
}
