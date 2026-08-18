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
/** WinAnsi bytes the writer emits, back to the characters they stand for. */
const FROM_WIN_ANSI = {
  133: '…', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•',
  150: '–', 151: '—', 167: '§', 176: '°', 183: '·',
};

const decode = (text) => text
  .replace(/\\([()\\])/g, '$1')
  .replace(/\\(\d{3})/g, (_, octal) => {
    const code = parseInt(octal, 8);
    return FROM_WIN_ANSI[code] ?? String.fromCharCode(code);
  });

function textOf(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);
  const shown = [];
  for (const stream of streams) {
    for (const match of stream.matchAll(/\((.*?)\) Tj/g)) shown.push(decode(match[1]));
  }
  return shown;
}

function pageCount(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  return (raw.match(/\/Type \/Page[^s]/g) ?? []).length;
}


/**
 * Every string drawn in the file, with the box it occupies.
 *
 * The content streams are uncompressed, so this reads them the way a renderer
 * does: track the current font and size, take the position off each text
 * matrix, and measure the string with the same metrics that laid it out.
 */
function draws(bytes) {
  return pagesOf(bytes).flatMap((page) => page.draws);
}

/** Filled rectangles, for the section bands and rules. */
function rects(bytes) {
  return pagesOf(bytes).flatMap((page) => page.rects);
}

/**
 * The same, kept per page.
 *
 * Anything comparing a rule against the text it might cross has to stay
 * within one page — a hairline near the foot of page one is not touching a
 * heading near the top of page two, however close their coordinates look.
 */
function pagesOf(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);

  return streams.map((stream) => {
    const page = { draws: [], rects: [] };
    let bold = false;
    let size = 10;
    let x = 0;
    let y = 0;

    for (const line of stream.split('\n')) {
      let match;
      if ((match = line.match(/^\/(F1|F2) ([\d.]+) Tf$/))) {
        bold = match[1] === 'F2';
        size = parseFloat(match[2]);
      } else if ((match = line.match(/^1 0 0 1 ([\d.-]+) ([\d.-]+) Tm$/))) {
        x = parseFloat(match[1]);
        y = parseFloat(match[2]);
      } else if ((match = line.match(/^\((.*)\) Tj$/))) {
        const text = decode(match[1]);
        page.draws.push({ text, x, y, size, bold, right: x + textWidth(text, size, bold) });
      } else if ((match = line.match(/^([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) re f$/))) {
        page.rects.push({
          x: parseFloat(match[1]), y: parseFloat(match[2]),
          w: parseFloat(match[3]), h: parseFloat(match[4]),
        });
      }
    }
    return page;
  });
}

/** The printable box: US Letter less the margins the layout declares. */
const BOX = { left: 50, right: 562, top: 792, bottom: 0 };

function assertInsideBox(bytes, what) {
  for (const draw of draws(bytes)) {
    assert.ok(draw.right <= BOX.right + 0.5,
      `${what}: "${draw.text}" ends at ${draw.right.toFixed(1)}, past the ${BOX.right} margin`);
    assert.ok(draw.x >= BOX.left - 0.5,
      `${what}: "${draw.text}" starts at ${draw.x}, left of the ${BOX.left} margin`);
    assert.ok(draw.y >= 0 && draw.y <= BOX.top,
      `${what}: "${draw.text}" sits at y ${draw.y}, off the page`);
  }
  for (const rect of rects(bytes)) {
    assert.ok(rect.x + rect.w <= BOX.right + 0.5,
      `${what}: a filled box ends at ${rect.x + rect.w}, past the ${BOX.right} margin`);
  }
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

  assert.deepEqual(textOf(bytes), ['Cash — $120,681 · 67.7%']);
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
  assert.match(text, /APPLICATION/);
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
  assert.ok(text.includes('—'), 'em dash used for what was not captured');
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

/* --- nothing leaves the page -------------------------------------------- */

test('nothing on the application sheet is drawn past the margins', () => {
  const { application, result } = scenario();
  const bytes = renderDocument(buildApplicationDocument({
    application, result, recordLabel: 'RANDY D ROLLINS — ROCKWOOD, TN',
  }));
  assertInsideBox(bytes, 'application sheet');
});

test('long names, long addresses and long notes still stay on the page', () => {
  // The real complaint: figures running off the right-hand edge. Every one of
  // these is a value a live screen can produce, and each used to be drawn
  // wherever the previous value happened to end.
  const bytes = renderDocument({
    title: 'Loan application',
    subtitle: 'CHRISTOPHER ALEXANDER MONTGOMERY-WHITFIELD III — SIMPSONVILLE, SOUTH CAROLINA',
    meta: 'Prepared 18 Aug 2026 13:31 · S.A.M — Sales Assistance in Mortgages',
    footer: 'Estimate only — not a quote, an offer, or a commitment to lend. '
      + 'Figures are screening estimates and the appraisal governs value.',
    blocks: [
      { type: 'heading', text: 'Application' },
      { type: 'row', label: 'Full name', value: 'CHRISTOPHER ALEXANDER MONTGOMERY-WHITFIELD III', strong: true },
      { type: 'row', label: 'Address', value: '14829 NORTHWEST GRANDVIEW TERRACE APARTMENT 2214, SIMPSONVILLE, SC 29681', strong: true },
      { type: 'row', label: 'A label far longer than its column', value: '$1,284,100', strong: true },
      { type: 'row', label: 'Closing costs', value: '$1,234,567', note: 'estimated, itemised below and subject to the Texas fee cap' },
      { type: 'row', label: "Lender's title policy", value: '$1,566', note: 'varies by state — set yours in Settings' },
      { type: 'figures', items: [
        { cap: 'Advertised', value: '$1,284,100', sub: 'before fees and costs, at the full LTV ceiling', tone: 'blue' },
        { cap: 'Take-home', value: '$1,212,085', sub: 'after fees and costs', tone: 'green' },
      ] },
      { type: 'note', text: 'Escrow and reserve deposits are not included — they depend on the tax bill, the insurance premium and the closing date. Real cash to the borrower will be lower.' },
      { type: 'callout', text: 'Loan type not confirmed — assuming Conventional at 80%. Ask the borrower; VA would open up materially more.', tone: 'amber' },
    ],
  });

  assertInsideBox(bytes, 'stress sheet');
});

test('a note that will not fit beside its value drops to its own line', () => {
  const long = 'estimated and itemised below, reduced by the Texas fee cap, '
    + 'and excluding escrow reserves which depend on the closing date';
  const bytes = renderDocument({
    title: 'x',
    blocks: [{ type: 'row', label: 'Closing costs', value: '$1,234,567', note: long }],
  });

  const shown = draws(bytes);
  const valueDraw = shown.find((d) => d.text === '$1,234,567');
  const noteDraw = shown.find((d) => d.text.startsWith('estimated'));

  assert.ok(noteDraw, 'the note is still on the sheet');
  assert.ok(noteDraw.y < valueDraw.y, 'and sits below the value rather than beside it');
  assert.ok(noteDraw.right <= BOX.right + 0.5);
});

test('a label longer than its column is cut rather than run into the value', () => {
  const bytes = renderDocument({
    title: 'x',
    blocks: [{ type: 'row', label: 'A label far longer than the column it lives in', value: '$100' }],
  });

  const shown = draws(bytes);
  const label = shown.find((d) => d.text.startsWith('A label'));
  const value = shown.find((d) => d.text === '$100');

  assert.ok(label.text.endsWith('…'), 'it is visibly truncated');
  assert.ok(label.right <= value.x, 'and cannot collide with the value column');
});

test('the application is the first thing on the sheet', () => {
  // What this file is for: somebody opens it to find out who the borrower is.
  // The cash-out figures are why the file exists, not what is read first.
  const { application, result } = scenario();
  const bytes = renderDocument(buildApplicationDocument({ application, result }));
  const shown = draws(bytes);

  const application_ = shown.findIndex((d) => d.text === 'APPLICATION');
  const cashOut = shown.findIndex((d) => d.text === 'CASH OUT');
  const calculation = shown.findIndex((d) => d.text === 'CALCULATION');

  assert.ok(application_ >= 0 && cashOut >= 0 && calculation >= 0, 'all three sections present');
  assert.ok(application_ < cashOut, 'the application comes before the figures');
  assert.ok(cashOut < calculation, 'and the figures before the workings');

  // And it carries the weight: the application rows are set in the bold face.
  const name = shown.find((d) => d.text === 'RANDY D ROLLINS');
  assert.equal(name.bold, true);
  assert.ok(name.size >= 10.5);
});

test('no separator rule is drawn through the text', () => {
  // The defect this exists for: rows were 13pt apart for 10.5pt type, so the
  // hairline under each row landed inside the next row's capitals. It looked
  // fine on a sample with short values, because the rule was tuned against
  // that sample rather than measured against the glyphs.
  const { application, result } = scenario({ coBorrower: true });
  const bytes = renderDocument(buildApplicationDocument({
    application, result, coBorrower: true, recordLabel: 'RANDY D ROLLINS — ROCKWOOD, TN',
  }));

  let hairlines = 0;

  for (const page of pagesOf(bytes)) {
    // Helvetica's cap height is 0.717 em and its descender 0.212. A glyph box
    // a shade larger than that is the honest test of "does the line touch it".
    const boxes = page.draws.map((d) => ({
      ...d,
      top: d.y + d.size * 0.73,
      bottom: d.y - d.size * 0.22,
    }));

    for (const rule of page.rects.filter((r) => r.h <= 2)) {
      hairlines += 1;
      for (const box of boxes) {
        const overlapsX = box.x < rule.x + rule.w && box.right > rule.x;
        const overlapsY = rule.y < box.top && rule.y + rule.h > box.bottom;
        assert.ok(!(overlapsX && overlapsY),
          `a rule at y ${rule.y.toFixed(1)} crosses "${box.text}" `
          + `(${box.bottom.toFixed(1)}–${box.top.toFixed(1)})`);
      }
    }
  }

  assert.ok(hairlines > 10, 'the sheet does have separator rules');
});

test('a section heading sits inside its band, not on top of it', () => {
  const { application, result } = scenario();
  const bytes = renderDocument(buildApplicationDocument({ application, result }));

  const bands = rects(bytes).filter((r) => r.h > 10 && r.w > 400);
  // Section headings only: the figures' captions are also bold and uppercase,
  // and they sit on the page rather than in a band.
  const headings = draws(bytes).filter((d) => d.bold && d.size === 8.5);

  assert.ok(bands.length >= 3, 'the sheet has section bands');

  for (const heading of headings) {
    const band = bands.find((b) => heading.y > b.y && heading.y < b.y + b.h);
    assert.ok(band, `"${heading.text}" is not inside any band`);
    assert.ok(heading.y - heading.size * 0.22 >= band.y - 0.5, `"${heading.text}" hangs below its band`);
    assert.ok(heading.y + heading.size * 0.73 <= band.y + band.h + 0.5,
      `"${heading.text}" pokes out of the top of its band`);
  }
});

test('rows do not overlap each other', () => {
  // Every value on the sheet gets its own horizontal band of the page.
  const bytes = renderDocument({
    title: 'x',
    blocks: [
      { type: 'row', label: 'One', value: 'FIRST VALUE', strong: true },
      { type: 'row', label: 'Two', value: 'SECOND VALUE', strong: true },
      { type: 'row', label: 'Three', value: 'A value long enough to wrap onto a second line all by itself here', strong: true },
      { type: 'row', label: 'Four', value: 'FOURTH VALUE', strong: true },
    ],
  });

  const values = draws(bytes)
    .filter((d) => d.bold && d.size > 10)
    .sort((a, b) => b.y - a.y);

  for (let i = 1; i < values.length; i++) {
    const above = values[i - 1];
    const below = values[i];
    assert.ok(below.y + below.size * 0.73 < above.y - above.size * 0.22,
      `"${below.text}" overlaps "${above.text}"`);
  }
});
