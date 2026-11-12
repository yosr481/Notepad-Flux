// Stock CodeMirror control for RTL-1: bundled at test time (esbuild API, temp dir) and loaded in a plain
// BrowserWindow of the packaged Electron, so it runs on the same Chromium as the app.
import { EditorView, Decoration } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

const mode = new URLSearchParams(location.search).get('mode')
const doc = 'abc שלום עולם def ghi\n'
const extensions = [EditorView.lineWrapping]
if (mode === 'perline' || mode === 'perline-dir') extensions.push(EditorView.perLineTextDirection.of(true))
// what the app's textDirection.js does: tag each line dir="ltr"/"rtl" (first strong character) via a line decoration
if (mode === 'perline-dir') extensions.push(EditorView.decorations.of(Decoration.set([Decoration.line({ attributes: { dir: 'ltr' } }).range(0)])))
const view = new EditorView({ state: EditorState.create({ doc, extensions }), parent: document.body })
document.body.style.cssText = 'margin:20px;font:16px sans-serif;background:#fff;color:#000'
window.__view = view
window.__head = () => view.state.selection.main.head
