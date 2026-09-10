import json
import shutil
import subprocess

import pytest

from app.platforms.threads import client as client_module

NODE = shutil.which("node")

HARNESS = """
const fs = require('fs');
const fn = fs.readFileSync(process.argv[2], 'utf8');
const scenarios = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const makeEnv = (s) => {
  global.document = {
    querySelectorAll: (sel) => (sel === 'script[type="application/json"]' ? (s.scripts || []) : []),
    querySelector: (sel) => {
      if (sel === 'article' && s.articles) return {};
      if (sel === 'input[type="password"]' && s.login) return {};
      return null;
    },
    body: { innerText: s.bodyText || '' },
  };
  global.window = { location: { pathname: s.path || '/search' } };
  return eval('(' + fn + ')');
};
let failed = 0;
for (const s of scenarios) {
  const got = makeEnv(s)();
  if (got !== s.expected) { failed++; console.log('FAIL', s.name, '=>', got, 'expected', s.expected); }
  else console.log('PASS', s.name, '=>', got);
}
process.exit(failed ? 1 : 0);
"""


def _run_js(tmp_path, scenarios) -> subprocess.CompletedProcess:
    (tmp_path / "pjs.js").write_text(client_module.PAGE_STATE_JS, encoding="utf-8")
    (tmp_path / "scen.json").write_text(json.dumps(scenarios), encoding="utf-8")
    (tmp_path / "harness.js").write_text(HARNESS, encoding="utf-8")
    return subprocess.run(
        [NODE, str(tmp_path / "harness.js"), str(tmp_path / "pjs.js"), str(tmp_path / "scen.json")],
        capture_output=True,
        text=True,
        timeout=30,
    )


@pytest.mark.skipif(NODE is None, reason="node tidak tersedia")
def test_page_state_js_syntax_valid(tmp_path):
    (tmp_path / "pjs.js").write_text(client_module.PAGE_STATE_JS, encoding="utf-8")
    proc = subprocess.run([NODE, "--check", str(tmp_path / "pjs.js")], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr


@pytest.mark.skipif(NODE is None, reason="node tidak tersedia")
def test_page_state_js_settled_relay(tmp_path):
    scenarios = [
        {
            "name": "populated-edges",
            "scripts": [{"textContent": json.dumps({"searchResults": {"edges": [{"node": {}}]}})}],
            "expected": "relay",
        },
        {
            "name": "empty-edges-array",
            "scripts": [{"textContent": json.dumps({"searchResults": {"edges": []}})}],
            "expected": "relay",
        },
        {
            "name": "nested",
            "scripts": [{"textContent": json.dumps({"props": {"page": {"searchResults": {"edges": []}}}})}],
            "expected": "relay",
        },
    ]
    proc = _run_js(tmp_path, scenarios)
    assert proc.returncode == 0, proc.stdout + proc.stderr


@pytest.mark.skipif(NODE is None, reason="node tidak tersedia")
def test_page_state_js_rejects_unsettled(tmp_path):
    scenarios = [
        # partial/unfinished JSON that merely contains the substring must NOT settle
        {
            "name": "partial-json",
            "scripts": [{"textContent": '{"searchResults":{"edges":[{"node":'}],
            "expected": "loading",
        },
        {"name": "invalid-json", "scripts": [{"textContent": '{"searchResults": oops'}], "expected": "loading"},
        {"name": "edges-null", "scripts": [{"textContent": json.dumps({"searchResults": {"edges": None}})}], "expected": "loading"},
        {"name": "sr-null", "scripts": [{"textContent": json.dumps({"searchResults": None})}], "expected": "loading"},
        {"name": "no-scripts", "scripts": [], "expected": "loading"},
        {"name": "no-substring", "scripts": [{"textContent": json.dumps({"foo": 1})}], "expected": "loading"},
    ]
    proc = _run_js(tmp_path, scenarios)
    assert proc.returncode == 0, proc.stdout + proc.stderr
