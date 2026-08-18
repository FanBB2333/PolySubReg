#!/usr/bin/env python3
"""Drive PolyU's Mock Subject Registration end to end, to work out the
selectors and the page flow the extension will need.

Everything stays on the `mock-subject-register-*.jsf` pages — the real
registration pages are never opened, and `Confirm` refuses to fire unless the
URL says `mock-`.

    python scripts/mock-register.py COMP6704
    python scripts/mock-register.py COMP6704:1881 COMP6703:1881
    python scripts/mock-register.py COMP6704 --no-confirm   # stop at Preview

A subject spec is `CODE` or `CODE:GROUP`; without a group the first offered one
is taken. Programme defaults to the first real option and category to
`Research Free Electives`; both --programme and --category match on a substring
of the visible label. Screenshots of each step land in `.debug/mock/`.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

REPO = Path(__file__).resolve().parent.parent
EXT = REPO / "build" / "chrome-mv3"
COOKIES = REPO / ".debug" / "cookies.json"
PROFILE = REPO / ".debug" / "profile"
SHOTS = REPO / ".debug" / "mock"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9490

BASE = "https://www38.polyu.edu.hk/eStudent/secure/my-subject-registration/"
START = BASE + "mock-subject-register-select-acad-year-sem.jsf"


def sel(element_id: str) -> str:
    """CSS selector for a JSF id — the colon has to be escaped."""
    return "#" + element_id.replace(":", "\\:")


# Ids on these pages are hand-written rather than JSF-generated, so unlike the
# subject-search pages they can be relied on. The row index is the only moving
# part, and it is carried by the per-row group / `+` ids.
GO = sel("mainForm:nextButton")
ADV_TAB = sel("mainForm:advancedSearchTab_lbl")
ADV_PROG = sel("mainForm:advSearchProgId")
ADV_CATEGORY = sel("mainForm:advSearchCategory")
ADV_CODE = sel("mainForm:advSearchSubjectCode")
ADV_SEARCH = sel("mainForm:advSearchButton")
ADD_TO_CART = sel("mainForm:selectButton")
CONFIRM = sel("mainForm:confirmButton")
RESULTS_ID = "mainForm:advancedSearchTable"
CART_ID = "mainForm:selectedSubjectTable"


# --------------------------------------------------------------------------- browser


def read_env() -> dict[str, str]:
    env = {}
    for line in (REPO / ".env").read_text().splitlines():
        key, _, value = line.strip().partition("=")
        if key:
            env[key] = value
    return env


def launch(playwright):
    """Attach to a debug Chrome on PORT, starting one if it is not up yet."""
    try:
        browser = playwright.chromium.connect_over_cdp(f"http://localhost:{PORT}")
        print("attached to the running debug browser")
        return browser
    except Exception:
        pass
    subprocess.Popen(
        [
            CHROME,
            f"--user-data-dir={PROFILE}",
            f"--remote-debugging-port={PORT}",
            "--no-first-run",
            "--no-default-browser-check",
            "--enable-unsafe-extension-debugging",
            "--window-size=1600,1050",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(4)
    browser = playwright.chromium.connect_over_cdp(f"http://localhost:{PORT}")
    browser.new_browser_cdp_session().send("Extensions.loadUnpacked", {"path": str(EXT)})
    context = browser.contexts[0]
    if COOKIES.exists():
        context.add_cookies(json.loads(COOKIES.read_text()))
        print("restored the saved eStudent session")
    return browser


def sign_in(context, page: Page) -> None:
    """Reach the mock start page, signing in through ADFS if the session died."""
    page.goto(START, wait_until="domcontentloaded")
    time.sleep(2)
    if "adfs.polyu.edu.hk" not in page.url:
        return
    print("session expired — signing in with the .env credentials")
    env = read_env()
    page.fill("#userNameInput", "hh\\" + env["NetID"])
    page.fill("#passwordInput", env["Password"])
    page.click("#submitButton")
    for _ in range(90):  # generous: MFA may need a tap on the phone
        time.sleep(2)
        if "www38.polyu.edu.hk/eStudent" in page.url:
            break
    if "www38.polyu.edu.hk/eStudent" not in page.url:
        sys.exit(f"could not sign in, stuck at {page.url}")
    COOKIES.parent.mkdir(parents=True, exist_ok=True)
    COOKIES.write_text(json.dumps(context.cookies(), indent=1))
    COOKIES.chmod(0o600)
    page.goto(START, wait_until="domcontentloaded")
    time.sleep(2)


def shot(page: Page, name: str) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / (name + ".png")), full_page=True)


def settle(page: Page, ms: int = 2500) -> None:
    """Wait out a RichFaces partial update (or a full submit)."""
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


# --------------------------------------------------------------------------- steps


def pick_by_label(page: Page, selector: str, wanted: str | None) -> str:
    """Select the option whose label contains `wanted`, else the first real one."""
    options = page.eval_on_selector(
        selector, "s => [...s.options].map(o => [o.value, o.text.trim()])"
    )
    real = [(v, t) for v, t in options if v not in ("", "0")]
    if not real:
        sys.exit(f"{selector} has no selectable options")
    if wanted:
        hit = [(v, t) for v, t in real if wanted.lower() in t.lower()]
        if not hit:
            sys.exit(
                f"no option matching {wanted!r} in {selector}; offered: "
                + ", ".join(t for _, t in real)
            )
        value, label = hit[0]
    else:
        value, label = real[0]
    page.select_option(selector, value)
    settle(page)
    return label


def open_advanced_search(page: Page, programme: str | None, category: str | None) -> None:
    page.click(ADV_TAB)
    settle(page)
    print("   programme:", pick_by_label(page, ADV_PROG, programme))
    # The category list is empty until the programme's AJAX round trip fills it.
    print("   category: ", pick_by_label(page, ADV_CATEGORY, category))


def search(page: Page, code_prefix: str) -> None:
    page.fill(ADV_CODE, code_prefix)
    page.click(ADV_SEARCH)
    settle(page)


def result_rows(page: Page) -> list[dict]:
    return page.evaluate(
        """(id) => {
             const table = document.getElementById(id);
             if (!table) return [];
             return [...table.rows].slice(1).map((row) => {
               const select = row.querySelector('select');
               const plus = row.querySelector('input[id$="advSearchAddSubjectButton_"]');
               return {
                 code: row.cells[0]?.innerText.trim(),
                 title: row.cells[1]?.innerText.trim(),
                 groupSelectId: select ? select.id : null,
                 plusId: plus ? plus.id : null,
                 groups: select
                   ? [...select.options].map(o => [o.value, o.text.trim()])
                   : [],
               };
             });
           }""",
        RESULTS_ID,
    )


def result_pages(page: Page) -> list[str]:
    return page.evaluate(
        """() => [...document.querySelectorAll('.rich-datascroller td')]
             .map(td => td.innerText.trim())
             .filter(t => /^[0-9]+$/.test(t))"""
    )


def goto_result_page(page: Page, number: str) -> None:
    page.evaluate(
        """(n) => {
             const td = [...document.querySelectorAll('.rich-datascroller td')]
               .find(td => td.innerText.trim() === n);
             if (td) td.click();
           }""",
        number,
    )
    settle(page)


def find_subject(page: Page, code: str) -> dict:
    """Locate a subject's row, walking the result pages if it is not on this one."""
    for number in [None] + result_pages(page):
        if number is not None:
            goto_result_page(page, number)
        for row in result_rows(page):
            if row["code"] == code:
                return row
    sys.exit(f"{code} is not in the search results")


def group_value(row: dict, wanted: str | None) -> tuple[str, str]:
    if not row["groups"]:
        sys.exit(f"{row['code']} offers no subject group — nothing to register")
    if wanted:
        hit = [(v, t) for v, t in row["groups"] if t.split("(")[0].strip() == wanted]
        if not hit:
            sys.exit(
                f"{row['code']} has no group {wanted}; offered: "
                + ", ".join(t for _, t in row["groups"])
            )
        return hit[0]
    return row["groups"][0]


def add_to_cart(page: Page, code: str, wanted_group: str | None) -> None:
    row = find_subject(page, code)
    value, label = group_value(row, wanted_group)
    print(f"   {code} — {row['title']}")
    print(f"     group {label}")
    page.select_option(sel(row["groupSelectId"]), value)
    settle(page, 1200)

    # `+` swaps the search panel for the component picker in place — it is not a
    # modal; the results table is simply gone until Add to Cart or Back.
    page.click(sel(row["plusId"]))
    settle(page)

    components = page.evaluate(
        """() => [...document.querySelectorAll('input[id^="mainForm:ComponentTable"]')]
             .filter(el => el.type === 'checkbox')
             .map(el => ({
               id: el.id,
               cells: [...el.closest('tr').cells].map(c => c.innerText.trim()),
             }))"""
    )
    if not components:
        sys.exit(f"no component rows appeared for {code}")
    for comp in components:
        page.check(sel(comp["id"]))
        print("     component " + " ".join(c for c in comp["cells"][:9] if c))
    if len(components) > 1:
        print("     note: all components ticked — PolyU accepts only one combination")
        print("           per subject, so check this one if it gets refused")

    page.click(ADD_TO_CART)
    settle(page)


def cart_contents(page: Page) -> list[list[str]]:
    return page.evaluate(
        """(id) => {
             const table = document.getElementById(id);
             if (!table) return [];
             return [...table.rows].slice(1)
               .map(r => [...r.cells].map(c => c.innerText.trim()))
               .filter(cells => cells.some(Boolean));
           }""",
        CART_ID,
    )


def confirm_label(page: Page) -> str:
    return page.eval_on_selector(CONFIRM, "el => el.value")


# --------------------------------------------------------------------------- main


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("subjects", nargs="*", help="CODE[:GROUP], default COMP6704")
    parser.add_argument("--programme", help="substring of the programme label")
    parser.add_argument(
        "--category",
        default="Research Free Electives",
        help="substring of the subject category label",
    )
    parser.add_argument(
        "--no-confirm", action="store_true", help="stop at the preview, do not confirm"
    )
    args = parser.parse_args()
    specs = [
        (s.split(":", 1) + [None])[:2] for s in (args.subjects or ["COMP6704"])
    ]

    with sync_playwright() as p:
        browser = launch(p)
        context = browser.contexts[0]
        page = context.pages[0] if context.pages else context.new_page()

        print("1. opening the mock registration")
        sign_in(context, page)
        if "select-acad-year-sem" in page.url:
            label = page.evaluate(
                """() => [...document.querySelectorAll('#mainForm *')]
                     .map(el => el.textContent.trim())
                     .find(t => /^Academic Year \\/ Semester: \\S/.test(t)) || ''"""
            )
            print("  ", label or "(year/semester page)")
            page.click(GO)
            settle(page)
        if "select-subject" not in page.url:
            sys.exit(f"expected the select-subject page, got {page.url}")
        shot(page, "1-select")

        print("2. advanced search")
        open_advanced_search(page, args.programme, args.category)
        prefix = re.match(r"[A-Za-z]+", specs[0][0]).group()
        search(page, prefix)
        print(f"   searched {prefix!r} — {len(result_rows(page))} subject(s) on page 1")
        shot(page, "2-results")

        print("3. adding to the cart")
        for code, group in specs:
            add_to_cart(page, code, group)
            if not any(cells[1] == code for cells in cart_contents(page)):
                sys.exit(f"{code} did not reach the cart")
            if not page.query_selector(sel(RESULTS_ID)):
                search(page, prefix)  # the picker replaced the list
        for cells in cart_contents(page):
            print("   cart:", " | ".join(c for c in cells if c))
        shot(page, "3-cart")

        print("4. proceed to preview")
        if confirm_label(page) != "Proceed to Preview":
            sys.exit(f"unexpected button here: {confirm_label(page)!r}")
        page.click(CONFIRM)
        settle(page)
        for cells in cart_contents(page):
            print("   preview:", " | ".join(c for c in cells if c))
        shot(page, "4-preview")

        if args.no_confirm:
            print("5. stopping before Confirm (--no-confirm)")
            return

        print("5. confirm")
        if "mock-" not in page.url:
            sys.exit(f"refusing to confirm outside the mock pages: {page.url}")
        if confirm_label(page) != "Confirm":
            sys.exit(f"unexpected button here: {confirm_label(page)!r}")
        page.click(CONFIRM)
        settle(page, 4000)
        shot(page, "5-done")
        print("  ", page.url)
        outcome = page.evaluate(
            """() => document.querySelector('.main-content')?.innerText?.trim() || ''"""
        )
        print("  ", " ".join(outcome.split())[:280])


if __name__ == "__main__":
    main()
