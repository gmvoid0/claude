/**
 * Laying a document out on pages.
 *
 * A small vocabulary of blocks — headings, label/value rows, callouts — with
 * a cursor that flows down the page and starts a new one when it runs out of
 * room.
 *
 * One convention holds the whole file together: **`this.y` is the top edge of
 * the next block**, never a baseline. Every block asks for the height it
 * needs, derives its baselines from that top, and moves the cursor by exactly
 * that height. The first version mixed the two — some blocks positioned from
 * a baseline, others from a top, with offsets tuned until a sample looked
 * right — and the separator rules ended up drawn straight through the next
 * row's capitals. Tuned offsets look correct for one set of values and are
 * wrong for the next.
 *
 * Kept apart from the PDF writer so the layout can be reasoned about without
 * thinking about object offsets, and apart from the application so the same
 * vocabulary can render anything else later.
 *
 * Pure: no DOM, no browser API.
 */

import { Page, assemble, textWidth, wrapText } from './pdf.js';

/** US Letter, in points. The floor prints on Letter, not A4. */
export const LETTER = { width: 612, height: 792 };

const MARGIN = { top: 54, bottom: 52, left: 50, right: 50 };

/**
 * A line box, as a share of the point size.
 *
 * Helvetica's cap height is 0.717 em and its descender 0.212. The box is
 * deliberately larger than both: the difference is the leading that keeps a
 * separator rule sitting on a box edge from touching the glyphs inside it.
 * At 0.78 the clearance above the capitals was four tenths of a point, which
 * a 0.4pt hairline consumed exactly.
 */
const ASCENT = 0.86;
const DESCENT = 0.30;
const LINE = ASCENT + DESCENT;

const INK = {
  text: [0.09, 0.10, 0.12],
  muted: [0.42, 0.45, 0.50],
  faint: [0.58, 0.61, 0.66],
  blue: [0.04, 0.39, 0.85],
  green: [0.14, 0.54, 0.24],
  red: [0.79, 0.14, 0.11],
  amber: [0.70, 0.37, 0.00],
  rule: [0.85, 0.87, 0.90],
  band: [0.93, 0.95, 0.98],
  tintBlue: [0.93, 0.96, 0.99],
  tintAmber: [0.99, 0.96, 0.90],
};

/**
 * Cut a string to fit a width, with an ellipsis.
 *
 * Used where wrapping is not an option — a label in a fixed column, a caption
 * under a figure. Running past the edge is the one outcome that is never
 * acceptable: text that leaves the page is not shortened, it is gone.
 */
function ellipsize(text, width, size, bold = false) {
  const full = String(text ?? '');
  if (textWidth(full, size, bold) <= width) return full;

  let cut = full;
  while (cut.length > 1 && textWidth(`${cut}…`, size, bold) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/**
 * Render a document description to PDF bytes.
 *
 * @param {{ title: string, subtitle?: string, meta?: string, blocks: Array }} doc
 */
export function renderDocument(doc, { page = LETTER } = {}) {
  const layout = new Layout(page);

  layout.documentHeader(doc.title, doc.subtitle, doc.meta);
  for (const block of doc.blocks ?? []) layout.block(block);
  layout.footers(doc.footer);

  return assemble(layout.pages, {
    title: doc.title,
    width: page.width,
    height: page.height,
  });
}

class Layout {
  constructor(size) {
    this.size = size;
    this.pages = [];
    this.contentWidth = size.width - MARGIN.left - MARGIN.right;
    this.newPage();
  }

  newPage() {
    this.page = new Page();
    this.pages.push(this.page);
    this.y = this.size.height - MARGIN.top;
    return this.page;
  }

  /** Reserve vertical space, moving to a new page if it will not fit. */
  need(height) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  /**
   * Draw one line of text in a box whose top is `top`, and return the box's
   * height. Nothing in this file positions text by baseline directly.
   */
  line(top, x, text, { size = 10, bold = false, colour = INK.text, lead = LINE } = {}) {
    this.page.text(x, top - size * ASCENT, text, { size, bold, colour });
    return size * lead;
  }

  documentHeader(title, subtitle, meta) {
    this.y -= this.line(this.y, MARGIN.left, title, { size: 19, bold: true, lead: 1.15 });

    if (subtitle) {
      // A borrower with three given names and a hyphenated surname is not an
      // edge case, and a name that runs off the sheet is worse than one that
      // takes two lines.
      this.y -= 3;
      for (const text of wrapText(subtitle, this.contentWidth, 11.5, true)) {
        this.y -= this.line(this.y, MARGIN.left, text, { size: 11.5, bold: true, colour: INK.blue });
      }
    }
    if (meta) {
      this.y -= 2;
      for (const text of wrapText(meta, this.contentWidth, 8)) {
        this.y -= this.line(this.y, MARGIN.left, text, { size: 8, colour: INK.faint });
      }
    }

    this.y -= 6;
    this.page.rect(MARGIN.left, this.y - 1.2, this.contentWidth, 1.2, INK.blue);
    this.y -= 11;
  }

  block(block) {
    const kind = block?.type;
    if (kind === 'heading') return this.heading(block);
    if (kind === 'row') return this.row(block);
    if (kind === 'figures') return this.figures(block);
    if (kind === 'note') return this.note(block);
    if (kind === 'callout') return this.callout(block);
    if (kind === 'spacer') return this.spacer(block);
    return undefined;
  }

  heading({ text }) {
    const size = 8.5;
    const band = 15;
    const gapAbove = 7;
    const gapBelow = 4;

    this.need(gapAbove + band + gapBelow);
    this.y -= gapAbove;

    const top = this.y;
    this.page.rect(MARGIN.left, top - band, this.contentWidth, band, INK.band);
    // Centre the cap height in the band rather than sitting it on the floor.
    this.page.text(MARGIN.left + 7, top - band + (band - size * 0.717) / 2, text.toUpperCase(), {
      size, bold: true, colour: INK.muted,
    });

    this.y -= band + gapBelow;
  }

  /**
   * A label/value row, with an optional grey note.
   *
   * The value column is fixed rather than measured so every row lines up —
   * this is a form read across, not down. The separator sits on the row's
   * bottom edge, below the descenders of this row and clear of the next
   * row's ascenders, which is the whole reason the box is measured first.
   */
  row({ label, value, note, tone, strong }) {
    const size = strong ? 10.5 : 9.5;
    const labelSize = 9;
    const noteSize = 8;

    const labelWidth = 128;
    const valueX = MARGIN.left + labelWidth;
    const right = MARGIN.left + this.contentWidth;

    const shown = value == null || value === '' ? '—' : String(value);
    const valueLines = wrapText(shown, right - valueX, size, !!strong);

    // Where the note goes is decided before anything is drawn, because it
    // changes the height of the row.
    const lastWidth = textWidth(valueLines[valueLines.length - 1], size, !!strong);
    const inlineX = valueX + lastWidth + 8;
    const inline = note && textWidth(note, noteSize) <= right - inlineX;
    const noteLines = note && !inline ? wrapText(note, right - valueX, noteSize) : [];

    const bodyHeight = valueLines.length * size * LINE + noteLines.length * noteSize * LINE;
    const height = Math.max(bodyHeight, labelSize * LINE) + 1.5;

    this.need(height);
    const top = this.y;

    this.page.text(
      MARGIN.left,
      top - labelSize * ASCENT,
      ellipsize(label, labelWidth - 8, labelSize),
      { size: labelSize, colour: INK.muted },
    );

    let cursor = top;
    for (const text of valueLines) {
      cursor -= this.line(cursor, valueX, text, {
        size,
        bold: !!strong,
        colour: value == null || value === '' ? INK.faint : (tone ? (INK[tone] ?? INK.text) : INK.text),
      });
    }

    if (inline) {
      this.page.text(inlineX, top - (valueLines.length - 1) * size * LINE - size * ASCENT, note, {
        size: noteSize, colour: INK.faint,
      });
    } else {
      for (const text of noteLines) {
        cursor -= this.line(cursor, valueX, text, { size: noteSize, colour: INK.faint });
      }
    }

    this.y = top - height;
    this.page.rect(MARGIN.left, this.y, this.contentWidth, 0.4, INK.rule);
  }

  /**
   * The pair of headline figures, side by side, as they appear on the panel.
   * Same two numbers in the same order, so the document and the screen never
   * have to be reconciled.
   */
  figures({ items = [] }) {
    const capSize = 8;
    const valueSize = 22;
    const subSize = 7.5;
    const height = capSize * LINE + valueSize * LINE + subSize * LINE + 8;

    this.need(height);
    const top = this.y;
    const columnWidth = this.contentWidth / Math.max(items.length, 1);

    items.forEach((item, index) => {
      const x = MARGIN.left + index * columnWidth;
      let cursor = top;

      cursor -= this.line(cursor, x, String(item.cap ?? '').toUpperCase(), {
        size: capSize, bold: true, colour: INK.muted,
      });
      cursor -= this.line(cursor, x, String(item.value ?? '—'), {
        size: valueSize, bold: true, colour: INK[item.tone] ?? INK.text,
      });
      if (item.sub) {
        this.line(cursor, x, ellipsize(item.sub, columnWidth - 10, subSize), {
          size: subSize, colour: INK.faint,
        });
      }
    });

    this.y = top - height;
  }

  note({ text, tone }) {
    const size = 8.5;
    const lines = wrapText(text, this.contentWidth, size);
    const height = lines.length * size * LINE + 4;

    this.need(height);
    let cursor = this.y;
    for (const line of lines) {
      cursor -= this.line(cursor, MARGIN.left, line, { size, colour: INK[tone] ?? INK.muted });
    }
    this.y -= height;
  }

  callout({ text, tone = 'blue' }) {
    const size = 8.5;
    const pad = 7;
    const lines = wrapText(text, this.contentWidth - 24, size);
    const box = lines.length * size * LINE + pad * 2;
    const height = box + 8;

    this.need(height);
    const top = this.y;

    const fill = tone === 'amber' ? INK.tintAmber : INK.tintBlue;
    const edge = tone === 'amber' ? INK.amber : INK.blue;
    this.page.rect(MARGIN.left, top - box, this.contentWidth, box, fill);
    this.page.rect(MARGIN.left, top - box, 2.5, box, edge);

    let cursor = top - pad;
    for (const line of lines) {
      cursor -= this.line(cursor, MARGIN.left + 13, line, {
        size, colour: tone === 'amber' ? INK.amber : INK.text,
      });
    }

    this.y = top - height;
  }

  spacer({ height = 8 }) {
    this.y -= height;
  }

  /** A rule and a line of small print on the foot of every page. */
  footers(text) {
    if (!text) return;
    const size = 7.5;

    this.pages.forEach((page, index) => {
      const label = `Page ${index + 1} of ${this.pages.length}`;
      const labelWidth = textWidth(label, size);

      // The disclaimer shares the line with the page number, so it is wrapped
      // against what is actually left rather than the full width.
      const lines = wrapText(text, this.contentWidth - labelWidth - 16, size);
      const top = MARGIN.bottom - 8;

      page.rect(MARGIN.left, top + 6, this.contentWidth, 0.4, INK.rule);
      lines.forEach((line, row) => {
        page.text(MARGIN.left, top - size * ASCENT - row * size * LINE, line, {
          size, colour: INK.faint,
        });
      });
      page.text(
        this.size.width - MARGIN.right - labelWidth,
        top - size * ASCENT,
        label,
        { size, colour: INK.faint },
      );
    });
  }
}
