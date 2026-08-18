import test from 'node:test';
import assert from 'node:assert/strict';

import { textWidth, wrapText, Page, assemble } from '../extension/src/lib/pdf.js';
import { renderDocument, LETTER } from '../extension/src/lib/document.js';
import { buildApplicationDocument, applicationFilename }
  from '../extension/src/lib/application-pdf.js';
import { buildApplication } from '../extension/src/lib/application.js';
import { computeEquity } from '../extension/src/lib/equity.js';
import { estimateClosingCosts } from '../extension/src/lib/closing.js';
import { mergeInputs } from '../extension/src/lib/merge.js';

/**
 * Read a generated PDF the way a reader does: find the page objects, pull the
 * uncompressed content streams, and recover the text that was drawn. The
 * streams are deliberately left uncompressed so this can be done without a
 * PDF library, which is the point — a test that cannot open the file it
 * produced is not testing much.
 */
function textOf(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);
  const shown = [];
  for (const stream of streams) {
    for (const match of stream.matchAll(/\((.*?)\) Tj/g)) {
      shown.push(match[1].replace(/\\([()\\])/g, '$1').replace(/\\(\d{3})/g, (_, o) =>
        String.fromCharCode(parseInt(o, 8))));
    }
  }
  return shown;
}

function pageCount(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  return (raw.match(/\/Type \/Page[^s]/g) ?? []).length;
}

/* --- the writer --------------------------------------------------------- */

test('measures Helvetica the way Helvetica actually measures', () => {
  // Adobe's published widths: a capital W is 944/1000 em, a lowercase i 222.
  assert.equal(textWidth('W', 100), 94.4);
  assert.equal(textWidth('i', 100), 22.2);
  assert.equal(textWidth('W', 100, true), 94.4);
  assert.equal(textWidth('i', 100, true), 27.8);
  assert.ok(textWidth('$120,681', 10) > textWidth('$1,681', 10));
});

test('wrapping breaks on spaces and never loses a word', () => {
  const text = 'Estimate only, not a quote or a commitment to lend';
  const lines = wrapText(text, 120, 9);

  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(textWidth(line, 9) <= 120, line);
  assert.equal(lines.join(' '), text);
});

test('a word longer than the line is emitted rather than dropped', () => {
  const lines = wrapText('SUPERCALIFRAGILISTIC', 20, 9);
  assert.deepEqual(lines, ['SUPERCALIFRAGILISTIC']);
});

test('the bytes are a structurally valid PDF', () => {
  const page = new Page();
  page.text(50, 700, 'Hello');
  const bytes = assemble([page], { title: 'T', width: 612, height: 792 });
  const raw = Buffer.from(bytes).toString('latin1');

  assert.ok(raw.startsWith('%PDF-1.4'), 'header');
  assert.ok(raw.trimEnd().endsWith('%%EOF'), 'trailer');
  assert.match(raw, /\/Type \/Catalog/);
  assert.match(raw, /\/Type \/Pages/);
  assert.match(raw, /\/BaseFont \/Helvetica\b/);
  assert.match(raw, /\/BaseFont \/Helvetica-Bold/);
  assert.match(raw, /startxref\n\d+/);
});

test('the cross-reference table points at the real byte offsets', () => {
  // Every reader seeks by these. One wrong offset and the file will not open,
  // which is a failure nobody sees until they double-click it.
  const page = new Page();
  page.text(50, 700, 'Costs — $8,596 · estimated');   // multi-byte on purpose
  const bytes = assemble([page], { title: 'Offsets', width: 612, height: 792 });
  const raw = Buffer.from(bytes).toString('latin1');

  const xrefAt = Number(raw.match(/startxref\n(\d+)/)[1]);
  assert.equal(raw.slice(xrefAt, xrefAt + 4), 'xref');

  const rows = [...raw.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(rows.length >= 6, 'one row per object');
  rows.forEach((offset, index) => {
    assert.match(raw.slice(offset, offset + 12), new RegExp(`^${index + 1} 0 obj`),
      `object ${index + 1} is not where the table says`);
  });
});

test('characters outside ASCII survive as WinAnsi rather than breaking the file', () => {
  const page = new Page();
  page.text(50, 700, 'Cash — $120,681 · 67.7%');
  const bytes = assemble([page], { title: 'x', width: 612, height: 792 });

  assert.deepEqual(textOf(bytes), ['Cash \x97 $120,681 \xB7 67.7%']);
});

test('parentheses and backslashes are escaped, not left to end the string', () => {
  const page = new Page();
  page.text(50, 700, 'Texas 50(a)(6) \\ homestead');
  const bytes = assemble([page], { title: 'x', width: 612, height: 792 });

  assert.deepEqual(textOf(bytes), ['Texas 50(a)(6) \\ homestead']);
});

/* --- the layout --------------------------------------------------------- */

test('content that overruns a page starts another one', () => {
  const blocks = [];
  for (let i = 0; i < 80; i++) blocks.push({ type: 'row', label: `Row ${i}`, value: `$${i}` });

  const bytes = renderDocument({ title: 'Long', blocks, footer: 'foot' }, { page: LETTER });
  assert.ok(pageCount(bytes) > 1, 'expected a page break');

  const text = textOf(bytes);
  assert.ok(text.includes('Row 0'));
  assert.ok(text.includes('Row 79'), 'nothing is dropped at the break');
  assert.ok(text.includes('Page 1 of 2') || text.includes('Page 1 of 3'));
});

/* --- the application sheet ---------------------------------------------- */

function scenario({ coBorrower = false } = {}) {
  const KEYS = ['propertyValue', 'firstLien', 'program', 'state', 'street', 'city', 'zip',
    'interestRate', 'fico', 'payment', 'phone', 'firstName', 'lastName'];

  const inputs = mergeInputs({
    manual: { propertyValue: '400000' },
    detected: {
      firstLien: { raw: '270900', source: 'auto' },
      program: { raw: 'VA', source: 'auto' },
      state: { raw: 'TN', source: 'auto' },
      street: { raw: '189 LEDGERWOOD LN', source: 'auto' },
      city: { raw: 'ROCKWOOD', source: 'auto' },
      zip: { raw: '37854', source: 'auto' },
      fico: { raw: '712', source: 'auto' },
      payment: { raw: '1806.42', source: 'auto' },
      phone: { raw: '3024239504', source: 'auto' },
      firstName: { raw: 'RANDY D', source: 'auto' },
      lastName: { raw: 'ROLLINS', source: 'auto' },
    },
    keys: KEYS,
  });

  const sized = computeEquity({
    propertyValue: inputs.propertyValue.num, firstLien: inputs.firstLien.num,
    program: 'VA', state: 'TN', financeFee: true, closingCosts: 0,
  });
  const closing = estimateClosingCosts({
    program: 'VA', state: 'TN', baseLoan: sized.maxBaseLoan, totalLoan: sized.totalLoanAmount,
  });
  const result = computeEquity({
    propertyValue: inputs.propertyValue.num, firstLien: inputs.firstLien.num,
    program: 'VA', state: 'TN', financeFee: true, closingCosts: closing.total,
  });
  result.closingEstimate = closing;

  const application = buildApplication({
    inputs, result, manual: { income: '96000', ...(coBorrower ? { coFullName: 'JANE ROLLINS' } : {}) },
    address: '189 LEDGERWOOD LN, ROCKWOOD, TN 37854',
    coBorrower,
  });

  return { application, result };
}

test('the sheet carries the same two figures the panel shows', () => {
  const { application, result } = scenario();
  const bytes = renderDocument(buildApplicationDocument({
    application, result, recordLabel: 'RANDY D ROLLINS — ROCKWOOD, TN',
  }));
  const text = textOf(bytes).join('\n');

  assert.match(text, /ADVERTISED/);
  assert.match(text, /\$129,100/);
  assert.match(text, /TAKE-HOME/);
  assert.match(text, /\$112,085/);
});

test('the sheet carries the borrower, the property and the calculation', () => {
  const { application, result } = scenario();
  const text = textOf(renderDocument(buildApplicationDocument({
    application, result, recordLabel: 'RANDY D ROLLINS — ROCKWOOD, TN',
  }))).join('\n');

  assert.match(text, /RANDY D ROLLINS/);
  assert.match(text, /3024239504/);
  assert.match(text, /189 LEDGERWOOD LN/);
  assert.match(text, /\$96,000/);          // income, typed as 96000 and presented
  assert.match(text, /\$270,900/);         // balance
  assert.match(text, /\$391,581/);         // max base loan
  assert.match(text, /VA funding fee/);
  assert.match(text, /\$8,419/);
  assert.match(text, /Origination/);       // itemised costs
  assert.match(text, /BORROWER/);
  assert.match(text, /CALCULATION/);
});

test('the disclaimer is on the sheet, not just on the screen', () => {
  const { application, result } = scenario();
  const text = textOf(renderDocument(buildApplicationDocument({ application, result }))).join(' ');
  assert.match(text, /not a quote/i);
  assert.match(text, /commitment to lend/i);
});

test('a co-borrower gets a section only when there is one', () => {
  const without = textOf(renderDocument(buildApplicationDocument(scenario()))).join('\n');
  assert.ok(!/CO-BORROWER/.test(without));

  const { application, result } = scenario({ coBorrower: true });
  const with_ = textOf(renderDocument(buildApplicationDocument({
    application, result, coBorrower: true,
  }))).join('\n');
  assert.match(with_, /CO-BORROWER/);
  assert.match(with_, /JANE ROLLINS/);
});

test('an empty field prints a dash rather than a blank gap', () => {
  const { application, result } = scenario();
  const text = textOf(renderDocument(buildApplicationDocument({ application, result })));
  assert.ok(text.includes('\x97'), 'em dash used for what was not captured');
});

test('flags travel with the sheet', () => {
  // A figure quoted without the caveat that produced it is the caveat being
  // lost, and this sheet is what gets emailed on.
  const { application } = scenario();
  const result = computeEquity({
    propertyValue: 400000, firstLien: 270900, program: null, state: 'TN', closingCosts: 0,
  });
  const text = textOf(renderDocument(buildApplicationDocument({ application, result }))).join(' ');

  assert.match(text, /FLAGS/);
  assert.match(text, /assuming Conventional/i);
});

test('the filename says who it is and when, and is safe on any filesystem', () => {
  const now = new Date(2026, 7, 17, 16, 54);
  const name = applicationFilename({
    application: { fullName: { value: "RANDY D O'ROLLINS JR" } },
    now,
  });

  assert.equal(name, 'SAM-RANDY-D-O-ROLLINS-JR-20260817-1654.pdf');
  assert.ok(!/[/\\:*?"<>|]/.test(name), 'no character a filesystem objects to');
});

test('an unnamed record still produces a filename', () => {
  const name = applicationFilename({ now: new Date(2026, 0, 2, 3, 4) });
  assert.equal(name, 'SAM-application-20260102-0304.pdf');
});
