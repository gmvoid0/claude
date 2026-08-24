/**
 * Build the copy-and-paste page for the Easy Qualifier probe.
 *
 * The page carries the probe script inside it, and a stale copy of a script
 * someone is about to paste into a live broker portal is worse than no copy
 * at all — so the page is generated from tools/eq-probe.js rather than kept
 * beside it. Run this after touching the probe.
 *
 *   node tools/build-eq-page.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const template = await fs.readFile(path.join(ROOT, 'tools/eq-page.template.html'), 'utf8');
const script = await fs.readFile(path.join(ROOT, 'tools/eq-probe.js'), 'utf8');

// Escaped for a <textarea>. The browser decodes these back on read, so what
// the Copy button puts on the clipboard is the file byte for byte.
const escaped = script.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const out = path.join(ROOT, 'docs/eq-probe-page.html');
// A function replacer, not a string: the probe contains a literal `$&`, and
// String.replace would read that as "the text I just matched" and splice the
// placeholder back into the middle of the script.
await fs.writeFile(out, template.replace('__SCRIPT__', () => escaped));

console.log(`${path.relative(ROOT, out)} — ${(await fs.stat(out)).size} bytes, script ${script.length}`);
