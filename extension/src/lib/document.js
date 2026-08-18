/**
 * Laying a document out on pages.
 *
 * A small vocabulary of blocks — headings, label/value rows, callouts — with
 * a cursor that flows down the page and starts a new one when it runs out of
 * room. Everything measures its own height first, so a row never lands half
 * on one page and half on the next.
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

  documentHeader(title, subtitle, meta) {
    this.page.text(MARGIN.left, this.y - 18, title, { size: 19, bold: true, colour: INK.text });
    this.y -= 26;

    if (subtitle) {
      this.page.text(MARGIN.left, this.y - 11, subtitle, { size: 11.5, bold: true, colour: INK.blue });
      this.y -= 17;
    }
    if (meta) {
      this.page.text(MARGIN.left, this.y - 8, meta, { size: 8, colour: INK.faint });
      this.y -= 13;
    }

    this.y -= 6;
    this.page.rect(MARGIN.left, this.y, this.contentWidth, 1.2, INK.blue);
    this.y -= 16;
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
    this.need(28);
    this.y -= 6;
    this.page.rect(MARGIN.left, this.y - 4, this.contentWidth, 15, INK.band);
    this.page.text(MARGIN.left + 6, this.y, text.toUpperCase(), {
      size: 8.5, bold: true, colour: INK.muted,
    });
    this.y -= 17;
  }

  /**
   * A label/value row, with an optional grey note after the value.
   *
   * The value column is fixed rather than measured so every row in the
   * document lines up — a form that is being read across, not down.
   */
  row({ label, value, note, tone, strong }) {
    const labelWidth = 128;
    const valueX = MARGIN.left + labelWidth;
    const colour = tone ? (INK[tone] ?? INK.text) : INK.text;
    const size = strong ? 10.5 : 9.5;

    const valueLines = wrapText(
      value == null || value === '' ? '—' : String(value),
      this.contentWidth - labelWidth - 4,
      size,
      !!strong,
    );

    this.need(valueLines.length * 12 + 3);

    this.page.text(MARGIN.left, this.y, label, { size: 9, colour: INK.muted });
    valueLines.forEach((line, index) => {
      this.page.text(valueX, this.y - index * 11, line, {
        size, bold: !!strong, colour: value == null || value === '' ? INK.faint : colour,
      });
    });

    if (note) {
      const lastWidth = textWidth(valueLines[valueLines.length - 1], size, !!strong);
      this.page.text(valueX + lastWidth + 8, this.y - (valueLines.length - 1) * 11, note, {
        size: 8, colour: INK.faint,
      });
    }

    this.y -= valueLines.length * 11 + 2;
    this.page.rect(MARGIN.left, this.y + 5, this.contentWidth, 0.4, INK.rule);
  }

  /**
   * The pair of headline figures, side by side, as they appear on the panel.
   * Same two numbers in the same order, so the document and the screen never
   * have to be reconciled.
   */
  figures({ items = [] }) {
    this.need(54);
    const columnWidth = this.contentWidth / Math.max(items.length, 1);

    items.forEach((item, index) => {
      const x = MARGIN.left + index * columnWidth;
      this.page.text(x, this.y, String(item.cap ?? '').toUpperCase(), {
        size: 8, bold: true, colour: INK.muted,
      });
      this.page.text(x, this.y - 25, String(item.value ?? '—'), {
        size: 22, bold: true, colour: INK[item.tone] ?? INK.text,
      });
      if (item.sub) {
        this.page.text(x, this.y - 37, item.sub, { size: 7.5, colour: INK.faint });
      }
    });

    this.y -= 46;
  }

  note({ text, tone }) {
    const lines = wrapText(text, this.contentWidth, 8.5);
    this.need(lines.length * 11 + 4);
    lines.forEach((line, index) => {
      this.page.text(MARGIN.left, this.y - index * 10.5, line, {
        size: 8.5, colour: INK[tone] ?? INK.muted,
      });
    });
    this.y -= lines.length * 10.5 + 4;
  }

  callout({ text, tone = 'blue' }) {
    const lines = wrapText(text, this.contentWidth - 20, 8.5);
    const height = lines.length * 11 + 14;
    this.need(height + 6);

    const fill = tone === 'amber' ? INK.tintAmber : INK.tintBlue;
    const edge = tone === 'amber' ? INK.amber : INK.blue;

    this.page.rect(MARGIN.left, this.y - height + 10, this.contentWidth, height, fill);
    this.page.rect(MARGIN.left, this.y - height + 10, 2.5, height, edge);

    lines.forEach((line, index) => {
      this.page.text(MARGIN.left + 12, this.y - index * 11, line, {
        size: 8.5, colour: tone === 'amber' ? INK.amber : INK.text,
      });
    });

    this.y -= height + 6;
  }

  spacer({ height = 8 }) {
    this.y -= height;
  }

  /** A rule and a line of small print on the foot of every page. */
  footers(text) {
    if (!text) return;
    this.pages.forEach((page, index) => {
      const y = MARGIN.bottom - 18;
      page.rect(MARGIN.left, y + 14, this.contentWidth, 0.4, INK.rule);
      page.text(MARGIN.left, y, text, { size: 7.5, colour: INK.faint });

      const label = `Page ${index + 1} of ${this.pages.length}`;
      page.text(
        this.size.width - MARGIN.right - textWidth(label, 7.5),
        y,
        label,
        { size: 7.5, colour: INK.faint },
      );
    });
  }
}
