#!/usr/bin/env python3
"""Verify gate for reports/2026-09-23-human-qa-1.4.0.html.

No arithmetic on this page, so the gate asserts every claim resolves against the repo:
installers exist and carry the stated version, fixtures exist, every quoted log line /
error message / shortcut is really emitted by the code, and the stated test count is
the number of test rows.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _page import page_text, must_state, must_contain

SLUG = "2026-09-23-human-qa-1.4.0"
REPO = pathlib.Path(__file__).resolve().parent.parent.parent
FIX = pathlib.Path.home() / "Documents" / "notepad-flux-qa"
html = (REPO / "reports" / f"{SLUG}.html").read_text(encoding="utf-8")
page = page_text(SLUG)
src = lambda p: (REPO / p).read_text(encoding="utf-8")
codes = lambda cls: set(re.findall(rf'<code class="{cls}">(.*?)</code>', html))
unesc = lambda s: s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

# 1. version: the packaged build really is the version the page names
VERSION = "1.4.0-qa.1"
must_contain(page, VERSION)

# 2. installers the page tells you to install exist
for name in codes("pkg"):
    assert (REPO / "release" / unesc(name)).is_file(), f"installer missing: {name}"
    assert VERSION in name, f"installer {name} is not {VERSION}"
assert codes("pkg"), "page names no installer"

# 3. fixtures exist
for f in codes("fx"):
    p = FIX / unesc(f)
    assert p.exists() or p.is_symlink(), f"fixture missing: {p}"

# 4. every quoted log line is emitted by main.js (or electron-updater / forwarded renderer)
main = src("electron/main.js")
for line in codes("log"):
    needle = unesc(line)
    assert needle in main, f"log line not emitted by electron/main.js: {needle!r}"
must_contain(main, "join(userDataPath, 'logs', 'main.log')")
must_contain(main, "join(home, '.config', 'notepad-flux')")
must_contain(page, "~/.config/notepad-flux/logs/main.log")

# 5. every quoted user-facing message exists in the code
msgs = src("electron/ipcErrorMessage.js") + src("src/hooks/useCommands.js") + src("src/components/Layout/Tab.jsx")
for m in codes("err"):
    assert unesc(m) in msgs, f"message not in code: {m!r}"

# 6. shortcuts exist in the menu
menu = src("src/components/Layout/MenuBar.jsx")
for k in set(re.findall(r"<kbd>(.*?)</kbd>", html)):
    assert f">{k}<" in menu, f"shortcut not in MenuBar: {k}"

# 7. test count stated == rows
rows = re.findall(r'data-test="([A-Z]\d+)"', html)
assert len(rows) == len(set(rows)), "duplicate test ids"
total = int(re.search(r'id="kpi-total">(\d+)<', html).group(1))
assert total == len(rows), f"KPI says {total} tests, page has {len(rows)}"
must_state(page, total)
summary = re.search(r'name="ledger:summary" content="([^"]*)"', html).group(1)
must_state(summary, total, label="(ledger:summary)")
assert f'id="kpi-left">{total}<' in html, "Not-run KPI must start at the total"

print(f"OK — {len(rows)} tests, {len(codes('fx'))} fixtures, {len(codes('log'))} log lines, "
      f"{len(codes('err'))} messages verified")
