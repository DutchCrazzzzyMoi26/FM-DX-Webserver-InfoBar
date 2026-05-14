# -*- coding: utf-8 -*-
"""
Example ticker generator for the FM-DX Webserver plugin "InfoBar".
Plugin author: DutchCrazzzzyMoi26

What this script does:
- Fetches the latest news items from RSS feeds.
- Writes a readable multi-line HTML/TXT file.
- Info Bar reads that TXT file and displays it as one scrolling ticker line.

Usage:
1. Adjust OUTPUT_FILE if needed.
2. Run this script manually, or run it every 5 minutes with Windows Task Scheduler.
3. Enter the same OUTPUT_FILE path in the Info Bar setup page.

No extra Python packages are required; it only uses the Python 3 standard library.
"""

from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Tuple

# === Settings ==============================================================

# This must match the path you enter in the Info Bar setup page.
# On Windows, keep the r-prefix before the string: r"D:\Scripts\message.txt"
OUTPUT_FILE = Path(r"D:\Scripts\message.txt")

# Keep this set to False when Windows Task Scheduler starts the script every 5 minutes.
# Set it to True if you want the script to keep running by itself.
RUN_FOREVER = False
UPDATE_EVERY_SECONDS = 300

# Number of items per news source.
ITEMS_PER_FEED = 3

# Clear the Python console after this many runs.
# This only cleans the Python screen; it does not remove anything from the TXT file.
CLEAR_SCREEN_EVERY_RUNS = 5

# RSS feeds. You can add, remove or replace feeds here.
FEEDS = [
    ("NU.nl", "https://www.nu.nl/rss/Algemeen", "📰"),
    ("NOS", "https://feeds.nos.nl/nosnieuwsalgemeen", "🟧"),
]

# General weather link for the Netherlands.
WEATHER_LABEL = "Netherlands"
WEERONLINE_URL = "https://www.weeronline.nl/Europa/Nederland/135"

# ========================================================================== 

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)


def fetch_text(url: str, timeout: int = 15) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


def clean_text(value: str, max_len: int = 130) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) > max_len:
        value = value[: max_len - 1].rstrip() + "…"
    return value


def safe_url(value: str) -> str:
    value = (value or "").strip()
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value
    return "#"


def anchor(url: str, text: str) -> str:
    return (
        f'<a href="{html.escape(safe_url(url), quote=True)}" '
        f'target="_blank" rel="noopener noreferrer">'
        f'{html.escape(clean_text(text), quote=False)}</a>'
    )


def parse_rss_items(xml_text: str, limit: int) -> List[Tuple[str, str]]:
    root = ET.fromstring(xml_text)
    items: List[Tuple[str, str]] = []

    for item in root.findall(".//item"):
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        if title and link:
            items.append((title, link))
        if len(items) >= limit:
            return items

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall(".//atom:entry", ns):
        title = entry.findtext("atom:title", default="", namespaces=ns)
        link_el = entry.find("atom:link", ns)
        link = link_el.get("href", "") if link_el is not None else ""
        if title and link:
            items.append((title, link))
        if len(items) >= limit:
            break

    return items


def feed_lines(name: str, url: str, icon: str) -> List[str]:
    try:
        xml_text = fetch_text(url)
        items = parse_rss_items(xml_text, ITEMS_PER_FEED)
        if not items:
            return [f"• {icon} {html.escape(name)}: no items found"]

        return [
            f"• {icon} {html.escape(name)} {anchor(link, f'🗞️ {title}')}"
            for title, link in items
        ]
    except Exception as exc:
        return [f"• {icon} {html.escape(name)}: feed unavailable ({html.escape(type(exc).__name__)})"]


def weather_part() -> str:
    return anchor(
        WEERONLINE_URL,
        f"🌤️ Weather {WEATHER_LABEL}: view the current forecast",
    )


def build_ticker_lines() -> List[str]:
    lines: List[str] = [weather_part()]
    for name, url, icon in FEEDS:
        lines.extend(feed_lines(name, url, icon))
    return lines


def clear_python_screen() -> None:
    # Windows uses cls, Linux/macOS uses clear.
    os.system("cls" if os.name == "nt" else "clear")


def write_ticker(run_number: int) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(build_ticker_lines())

    with OUTPUT_FILE.open("w", encoding="utf-8", newline="\n") as file:
        file.truncate(0)
        file.write(content)
        file.write("\n")

    last_update = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    print("=" * 70)
    print(f"FM-DX InfoBar ticker generator")
    print(f"Laatste update : {last_update}")
    print(f"Run nummer     : {run_number}")
    print(f"TXT bestand    : {OUTPUT_FILE}")
    print("=" * 70)
    print(content)
    print()


def main() -> None:
    run_number = 0

    if RUN_FOREVER:
        while True:
            run_number += 1

            if run_number == 1 or (run_number - 1) % CLEAR_SCREEN_EVERY_RUNS == 0:
                clear_python_screen()

            write_ticker(run_number)
            time.sleep(UPDATE_EVERY_SECONDS)
    else:
        run_number = 1
        clear_python_screen()
        write_ticker(run_number)


if __name__ == "__main__":
    main()
