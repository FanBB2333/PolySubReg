#!/usr/bin/env python3
"""Debug browser for PSR with a persistent eStudent session.

Chrome 137+ ignores --load-extension, so the extension is loaded through the
CDP Extensions domain (gated behind --enable-unsafe-extension-debugging).

Commands:
  login   Launch the browser, seed the extension with the credentials from
          .env, let the extension's own auto-login sign in to eStudent (watch
          the window and complete MFA there if prompted), then save the session
          cookies to .debug/cookies.json.
  open    Launch the browser, restore the saved cookies, and open eStudent
          already signed in. Optional argument: a URL to open instead.

The cookie file holds live session tokens — it is gitignored and chmod 600.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
EXT = REPO / "build" / "chrome-mv3-dev"
COOKIES = REPO / ".debug" / "cookies.json"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9490
ESTUDENT_URL = "https://www38.polyu.edu.hk/eStudent/secure/information/subject-search.jsf"


def read_env() -> dict[str, str]:
    env = {}
    for line in (REPO / ".env").read_text().splitlines():
        key, _, value = line.strip().partition("=")
        if key:
            env[key] = value
    return env


def launch(playwright):
    profile = REPO / ".debug" / "profile"
    profile.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [
            CHROME,
            f"--user-data-dir={profile}",
            f"--remote-debugging-port={PORT}",
            "--no-first-run",
            "--no-default-browser-check",
            "--enable-unsafe-extension-debugging",
            "--window-size=1600,1000",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(4)
    browser = playwright.chromium.connect_over_cdp(f"http://localhost:{PORT}")
    ext_id = browser.new_browser_cdp_session().send(
        "Extensions.loadUnpacked", {"path": str(EXT)}
    )["id"]
    print(f"extension loaded: {ext_id}")
    return proc, browser, ext_id


def seed_credentials(context, ext_id: str, domain: str) -> None:
    """Writes the .env credentials into the extension's storage.local."""
    env = read_env()
    page = context.new_page()
    page.goto(f"chrome-extension://{ext_id}/popup.html")
    page.evaluate(
        """([netId, password, domain]) => new Promise((resolve) =>
             chrome.storage.local.set({
               credentials: { netId, password, domain },
             }, resolve))""",
        [env["NetID"], env["Password"], domain],
    )
    page.close()
    print(f"credentials seeded into extension storage (domain {domain})")


def save_cookies(context) -> None:
    COOKIES.parent.mkdir(parents=True, exist_ok=True)
    COOKIES.write_text(json.dumps(context.cookies(), indent=1))
    os.chmod(COOKIES, 0o600)
    print(f"saved {len(context.cookies())} cookies -> {COOKIES}")


def restore_cookies(context) -> bool:
    if not COOKIES.exists():
        return False
    context.add_cookies(json.loads(COOKIES.read_text()))
    print(f"restored cookies from {COOKIES}")
    return True


def cmd_login(domain: str = "@connect.polyu.edu.hk") -> None:
    with sync_playwright() as p:
        proc, browser, ext_id = launch(p)
        context = browser.contexts[0]
        seed_credentials(context, ext_id, domain)

        page = context.pages[0] if context.pages else context.new_page()
        page.goto(ESTUDENT_URL, wait_until="domcontentloaded")
        print("waiting for sign-in (complete MFA in the browser window if prompted)…")
        for _ in range(90):  # up to 3 minutes
            time.sleep(2)
            if "www38.polyu.edu.hk/eStudent" in page.url:
                break
            error = page.evaluate(
                """() => document.querySelector('#errorText, #error')?.textContent?.trim() || ''"""
            )
            if error:
                print(f"ADFS error: {error}")
                print("fix the credentials (popup) and sign in manually, still waiting…")
        if "www38.polyu.edu.hk/eStudent" in page.url:
            print(f"signed in: {page.url}")
            save_cookies(context)
        else:
            print(f"NOT signed in, still at: {page.url}")
            print("cookies were not saved")
        browser.close()
        proc.terminate()


def cmd_open(url: str) -> None:
    with sync_playwright() as p:
        proc, browser, _ = launch(p)
        context = browser.contexts[0]
        if not restore_cookies(context):
            print("no saved cookies — run `login` first")
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(url, wait_until="domcontentloaded")
        print(f"opened: {page.url}")
        if "adfs.polyu.edu.hk" in page.url:
            print("session expired — run `login` again to refresh the cookies")
        print("browser stays open; Ctrl-C here when done (window survives)")
        try:
            while proc.poll() is None:
                time.sleep(5)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "open"
    if cmd == "login":
        cmd_login(sys.argv[2] if len(sys.argv) > 2 else "@connect.polyu.edu.hk")
    elif cmd == "open":
        cmd_open(sys.argv[2] if len(sys.argv) > 2 else ESTUDENT_URL)
    else:
        print(__doc__)
        sys.exit(1)
