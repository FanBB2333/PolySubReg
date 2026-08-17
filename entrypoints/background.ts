import { defineBackground } from 'wxt/utils/define-background';

/**
 * Every feature runs in a content script against the PolyU pages, so the
 * service worker has no work of its own. It exists because MV3 extensions
 * without one cannot be reloaded reliably during `wxt dev`.
 */
export default defineBackground(() => {});
