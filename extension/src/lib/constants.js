/**
 * Identifiers shared between the panel and the detector.
 *
 * These live in their own module specifically so the detector can exclude the
 * extension's own UI without importing the panel. The panel is mounted in an
 * *open* shadow root, which the detector traverses like any other — so
 * without this the panel's own labels and figures are harvested as if they
 * were page data, and it reads its own output back in as input.
 */

/** id of the light-DOM element hosting the panel's shadow root. */
export const PANEL_HOST_ID = '__equity_lens_host__';

/** Class on the picker's hover highlight, injected into the host page. */
export const PICKER_HIGHLIGHT_CLASS = '__eqlens_pick_hl';
