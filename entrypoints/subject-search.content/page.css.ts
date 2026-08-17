/**
 * Styles for the handful of elements we inject into the page's own DOM (the
 * expand toggle and the inline summary chips). Everything richer lives inside a
 * shadow root with Tailwind; these few rules have to survive PolyU's stylesheet,
 * hence the explicit resets.
 */
export const PAGE_CSS = `
.psr-expand-toggle {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 4px;
  border: 1px solid #dbd7d0;
  background: #fdfdfd;
  color: #6a615b;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.psr-expand-toggle:hover {
  background: #537e54;
  border-color: #537e54;
  color: #f8f8f8;
}
.psr-expand-toggle[aria-expanded="true"] {
  background: #537e54;
  border-color: #537e54;
  color: #f8f8f8;
}

.psr-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.psr-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
  white-space: nowrap;
}
.psr-chip-primary {
  background: rgba(83, 126, 84, .12);
  border-color: rgba(83, 126, 84, .3);
  color: #3f5f40;
}
.psr-chip-muted {
  background: #f1efec;
  border-color: #dbd7d0;
  color: #6a615b;
}

.psr-detail-row > td {
  background: #f5f3f0;
  border-top: 1px solid #dbd7d0;
  border-bottom: 1px solid #dbd7d0;
}
`;

export function injectPageCss(): void {
  if (document.getElementById('psr-page-css')) return;
  const style = document.createElement('style');
  style.id = 'psr-page-css';
  style.textContent = PAGE_CSS;
  document.head.appendChild(style);
}
