/**
 * Click-to-bind element picker.
 *
 * Auto-detection is a heuristic; this is the escape hatch. The user clicks a
 * field on the page and we store a selector for it, so from then on that
 * field is read directly instead of guessed.
 */

import { buildSelector } from '../lib/selector.js';
import { PICKER_CSS } from './styles.js';
import { PANEL_HOST_ID } from '../lib/constants.js';

let active = null;

/**
 * Start picking. Resolves with { selector, label, raw } or null if cancelled.
 * Only one picker can be active at a time.
 */
export function pickElement({ prompt = 'Click the field to bind — Esc to cancel' } = {}) {
  if (active) active.cancel();

  return new Promise((resolve) => {
    const style = document.createElement('style');
    style.textContent = PICKER_CSS;
    document.documentElement.appendChild(style);

    const highlight = document.createElement('div');
    highlight.className = '__eqlens_pick_hl';
    document.body.appendChild(highlight);

    const hint = document.createElement('div');
    hint.textContent = prompt;
    Object.assign(hint.style, {
      position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)',
      zIndex: '2147483647', background: '#7c3aed', color: '#fff',
      padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 6px 20px rgba(0,0,0,.3)', pointerEvents: 'none',
    });
    document.documentElement.appendChild(hint);

    let current = null;

    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === highlight || el === hint) return;
      // Don't let the picker target our own panel.
      if (el.id === PANEL_HOST_ID || el.closest?.(`#${PANEL_HOST_ID}`)) return;
      current = el;
      const r = el.getBoundingClientRect();
      Object.assign(highlight.style, {
        left: `${r.left + window.scrollX}px`,
        top: `${r.top + window.scrollY}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    };

    const finish = (result) => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      highlight.remove();
      hint.remove();
      style.remove();
      active = null;
      resolve(result);
    };

    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = current ?? document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return finish(null);

      // If they clicked a label or wrapper, prefer a form control inside it.
      const target = el.matches?.('input, select, textarea')
        ? el
        : (el.querySelector?.('input, select, textarea') ?? el);

      finish({
        selector: buildSelector(target),
        raw: readRaw(target),
        tag: target.tagName?.toLowerCase() ?? null,
      });
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);

    active = { cancel: () => finish(null) };
  });
}

function readRaw(el) {
  if (!el) return null;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'select') return el.selectedOptions?.[0]?.textContent ?? el.value ?? '';
  if (tag === 'input' || tag === 'textarea') return el.value ?? '';
  return (el.textContent ?? '').trim();
}
