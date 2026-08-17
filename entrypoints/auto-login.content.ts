import { defineContentScript } from 'wxt/utils/define-content-script';
import { credentialsItem, getSettings } from '@/lib/storage';
import { adfsUsername } from '@/lib/types';

/**
 * eStudent sits behind PolyU's ADFS SSO. Rather than replaying the SAML flow
 * ourselves, we fill in the real sign-in form and submit it — the browser then
 * completes the redirect chain exactly as it would for a manual login, which
 * also keeps any MFA step working.
 */
export default defineContentScript({
  matches: ['https://adfs.polyu.edu.hk/adfs/ls/*'],
  runAt: 'document_idle',

  async main() {
    const settings = await getSettings();
    if (!settings.autoLogin) return;

    const credentials = await credentialsItem.getValue();
    if (!credentials.netId || !credentials.password) return;

    const form = document.querySelector<HTMLFormElement>('#loginForm');
    const userInput = document.querySelector<HTMLInputElement>('#userNameInput');
    const passwordInput =
      document.querySelector<HTMLInputElement>('#passwordInput');
    if (!form || !userInput || !passwordInput) return;

    // ADFS re-renders the same form with an error message after a bad password.
    // Submitting again would burn another attempt and eventually lock the
    // account, so hand control back to the user as soon as one is shown.
    const errorText = document
      .querySelector('#errorText, #error')
      ?.textContent?.trim();
    if (errorText) {
      console.info('[PSR] ADFS reported an error, skipping auto login:', errorText);
      return;
    }

    // A page reload that lands back here means the previous submit did not get
    // us through. One attempt per tab session is enough.
    const ATTEMPT_KEY = 'psr:auto-login-attempted';
    if (sessionStorage.getItem(ATTEMPT_KEY)) return;
    sessionStorage.setItem(ATTEMPT_KEY, '1');

    const username = adfsUsername(credentials);

    setNativeValue(userInput, username);
    setNativeValue(passwordInput, credentials.password);

    // ADFS mirrors the username into a hidden field for the "other sign-in
    // options" form; keep the two in step.
    const mirror = document.querySelector<HTMLInputElement>(
      '#userNameInputOptionsHolder',
    );
    if (mirror) mirror.value = username;

    const submit = document.querySelector<HTMLElement>('#submitButton');
    if (submit) submit.click();
    else form.submit();
  },
});

/**
 * ADFS validates on `input`/`change`, and React-style value tracking is not the
 * only thing that cares — assigning through the prototype setter makes the
 * events land on a value the page actually sees.
 */
function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter ? setter.call(input, value) : (input.value = value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
