/**
 * A very small PDF writer.
 *
 * Why this exists rather than a library: the panel runs as a content script
 * inside somebody else's page, under whatever Content-Security-Policy that
 * page sets. Pulling jsPDF or pdf-lib in means shipping a few hundred
 * kilobytes into every tab to lay out a one-page form. This produces the
 * same document in a few hundred lines, with no dependency to keep current.
 *
 * The output is PDF 1.4 with the two built-in Helvetica faces, which every
 * reader has had since 1993 — so nothing is embedded and the file stays
 * around 4 KB. Streams are left uncompressed on purpose: at this size the
 * saving is meaningless and an uncompressed content stream can be read with
 * `strings`, which makes the tests honest and a support call short.
 *
 * Text is measured with the real Helvetica metrics, so wrapping, centring
 * and right-alignment land where they should rather than approximately.
 *
 * Pure: no DOM, no browser API. Returns bytes.
 */

/* ------------------------------------------------------------------ *
 * Font metrics — Adobe's published widths, in 1/1000 em
 * ------------------------------------------------------------------ */

const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * Characters outside ASCII that are worth keeping, mapped to their WinAnsi
 * byte and width. Anything else is transliterated rather than dropped — a
 * missing glyph in a figure would be worse than an approximated one.
 */
const WIN_ANSI = {
  '–': [150, 556, 556],   // en dash
  '—': [151, 1000, 1000], // em dash
  '‘': [145, 222, 278],   // left single quote
  '’': [146, 222, 278],   // right single quote
  '“': [147, 333, 500],   // left double quote
  '”': [148, 333, 500],   // right double quote
  '•': [149, 350, 350],   // bullet
  '·': [183, 278, 278],   // middle dot
  '§': [167, 556, 556],   // section
  '°': [176, 400, 400],   // degree
  ' ': [32, 278, 278],    // non-breaking space
};

const FALLBACK = { '…': '...', '−': '-', '×': 'x' };

/** One character's width in 1/1000 em, for the given face. */
function charWidth(ch, bold) {
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return (bold ? HELVETICA_BOLD : HELVETICA)[code - 32];
  }
  const win = WIN_ANSI[ch];
  if (win) return bold ? win[2] : win[1];
  return bold ? HELVETICA_BOLD[0] : HELVETICA[0];
}

/** Width of a string at a given point size. */
export function textWidth(text, size, bold = false) {
  let total = 0;
  for (const ch of String(text ?? '')) total += charWidth(ch, bold);
  return (total * size) / 1000;
}

/**
 * Encode for a PDF string literal: WinAnsi bytes, with the three characters
 * that would otherwise end the literal escaped.
 */
function pdfString(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const code = ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') { out += `\\${ch}`; continue; }
    if (code >= 32 && code <= 126) { out += ch; continue; }
    const win = WIN_ANSI[ch];
    if (win) { out += `\\${win[0].toString(8).padStart(3, '0')}`; continue; }
    const fallback = FALLBACK[ch];
    if (fallback) { out += fallback; continue; }
    out += '?';
  }
  return out;
}

/** Break a string to fit a width, on spaces where it can. */
export function wrapText(text, width, size, bold = false) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------------ *
 * The page canvas
 * ------------------------------------------------------------------ */

/**
 * Collects drawing operations for one page. Coordinates are PDF user space:
 * origin bottom-left, y increasing upwards.
 */
class Page {
  constructor() {
    this.ops = [];
  }

  text(x, y, value, { size = 10, bold = false, colour = [0, 0, 0] } = {}) {
    const [r, g, b] = colour;
    this.ops.push(
      'BT',
      `${fmt(r)} ${fmt(g)} ${fmt(b)} rg`,
      `/${bold ? 'F2' : 'F1'} ${fmt(size)} Tf`,
      `1 0 0 1 ${fmt(x)} ${fmt(y)} Tm`,
      `(${pdfString(value)}) Tj`,
      'ET',
    );
  }

  rect(x, y, w, h, colour = [0, 0, 0]) {
    const [r, g, b] = colour;
    this.ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`, `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`);
  }

  toStream() {
    return this.ops.join('\n');
  }
}

function fmt(n) {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

const encoder = new TextEncoder();

/**
 * Serialise pages into a PDF file.
 *
 * The cross-reference table has to carry the exact byte offset of every
 * object, so the body is built as bytes first and measured as it goes —
 * counting characters would be wrong the moment a WinAnsi escape appears.
 */
export function assemble(pages, { title = '', author = 'S.A.M', width, height }) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const fontBoldId = 4;
  objects.push('', '', '', '');   // reserved, filled in below

  const pageIds = [];
  for (const page of pages) {
    const stream = page.toStream();
    const streamBytes = encoder.encode(stream).length;
    const contentId = add(
      `<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`,
    );
    pageIds.push(add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fmt(width)} ${fmt(height)}] `
      + `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> `
      + `/Contents ${contentId} 0 R >>`,
    ));
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[fontId - 1] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[fontBoldId - 1] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  const infoId = add(
    `<< /Title (${pdfString(title)}) /Author (${pdfString(author)}) `
    + `/Producer (${pdfString('S.A.M')}) /CreationDate (${pdfDate(new Date())}) >>`,
  );

  const chunks = [];
  let length = 0;
  const push = (text) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(length);
    push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefAt = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`
    + `startxref\n${xrefAt}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

function pdfDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export { Page };
