import ReactDOM from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { SearchableSelect, type SelectOption } from '@/components/SearchableSelect';

const ENHANCED = 'data-psr-enhanced';
const MIN_WIDTH = 200;
const MAX_WIDTH = 460;

/**
 * Swaps every criteria `<select>` on the subject search form for a combobox
 * that filters as you type — the department list alone is 70 entries long and
 * the native control offers no way to search it.
 *
 * The original `<select>` stays in the DOM (just hidden) and remains the single
 * source of truth: JSF reads its value on submit, and `main.js` binds its
 * auto-submit behaviour to the element's own `change` event.
 */
export async function enhanceSelects(ctx: ContentScriptContext): Promise<void> {
  const selects = document.querySelectorAll<HTMLSelectElement>(
    'form#mainForm select.dropdown-style',
  );

  for (const select of selects) {
    if (select.hasAttribute(ENHANCED)) continue;
    // `size > 1` renders as a list box, not a dropdown; leave those alone.
    if (select.multiple || select.size > 1) continue;
    select.setAttribute(ENHANCED, '');

    const width = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, select.getBoundingClientRect().width || MIN_WIDTH),
    );
    select.style.display = 'none';

    await mountSelect(ctx, select, width);
  }
}

function readOptions(select: HTMLSelectElement): SelectOption[] {
  return Array.from(select.options, (o) => ({
    value: o.value,
    label: o.textContent?.trim() ?? o.value,
  }));
}

async function mountSelect(
  ctx: ContentScriptContext,
  select: HTMLSelectElement,
  width: number,
): Promise<void> {
  const ui = await createShadowRootUi(ctx, {
    name: 'psr-select',
    position: 'inline',
    anchor: select,
    append: 'after',
    onMount: (container) => {
      const root = ReactDOM.createRoot(container);

      const render = () => {
        const options = readOptions(select);
        const placeholder =
          options.find((o) => o.value === '')?.label ?? '-- Please Select --';
        root.render(
          <SearchableSelect
            options={options.filter((o) => o.value !== '')}
            value={select.value}
            placeholder={placeholder}
            width={width}
            disabled={select.disabled}
            onChange={(next) => {
              select.value = next;
              // jQuery in the page's own main.js listens for a native `change`
              // to show the "please wait" dialog and re-submit the form.
              select.dispatchEvent(new Event('change', { bubbles: true }));
              render();
            }}
          />,
        );
      };
      render();

      // The Programme dropdown is repopulated by an AJAX round trip after the
      // hosting department changes; pick up the new options when that happens.
      const observer = new MutationObserver(render);
      observer.observe(select, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled'],
      });

      return { root, observer };
    },
    onRemove: (mounted) => {
      mounted?.observer.disconnect();
      mounted?.root.unmount();
    },
  });

  ui.mount();
}
