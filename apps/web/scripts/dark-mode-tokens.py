#!/usr/bin/env python3
"""
Apply brutalist dark mode token transforms to AdminCoursesPage.tsx.

Strict spec (per user):
  bg-white                    -> bg-white dark:bg-neutral-100
  border-[#171717]            -> border-[#171717] dark:border-neutral-50
  text-[#171717]              -> text-[#171717] dark:text-neutral-50
  bg-[#EEEDE9]                -> bg-[#EEEDE9] dark:bg-neutral-800
  bg-[#F5F4F0]                -> bg-[#F5F4F0] dark:bg-neutral-800
  text-[#666666]              -> text-[#666666] dark:text-neutral-400
  text-[#999999]              -> text-[#999999] dark:text-neutral-500
  hover:bg-[#EEEDE9]          -> hover:bg-[#EEEDE9] dark:hover:bg-neutral-800

  hover:bg-[#171717] hover:text-white  -> 保留 (KEEP AS-IS)

NOT touched (not in spec):
  - bg-[#171717] (the solid black "primary" bg)
  - hover:bg-[#171717] (hover solid black)
  - text-[#A3A3A3] (not in spec)
  - bg-[#262626] (not in spec)
  - bg-[#4B5563] (not in spec)
  - focus:bg-[#EEEDE9] / focus:border-[#171717] (focus variants not listed)
  - hover:text-[#171717] (hover variant of text not listed)

Strategy: process hover variants FIRST. Then for the general variants, use
a negative lookbehind `(?<![:\w-])` to ensure the char before is not a
variant prefix (hover:, focus:, etc.) or a word char. This prevents
re-matching tokens we've already transformed.
"""
import re
import sys
from pathlib import Path

# (regex_pattern, replacement) — apply in order.
# Hover variant first to avoid re-matching by the general pattern.
# The general patterns use (?<![:\w-]) lookbehind to skip variant prefixes.
TRANSFORMS = [
    # Hover variants (must come first) — no boundary check needed, exact match
    (r"hover:bg-\[#EEEDE9\](?![\w-])", "hover:bg-[#EEEDE9] dark:hover:bg-neutral-800"),
    # General variants — lookbehind avoids `hover:`, `focus:`, `dark:` etc.;
    # lookahead avoids partial matches like `bg-[#EEEDE9]0` (pre-existing bug).
    (r"(?<![:\w-])bg-white(?![\w-])",            "bg-white dark:bg-neutral-100"),
    (r"(?<![:\w-])border-\[#171717\](?![\w-])",  "border-[#171717] dark:border-neutral-50"),
    (r"(?<![:\w-])text-\[#171717\](?![\w-])",    "text-[#171717] dark:text-neutral-50"),
    (r"(?<![:\w-])bg-\[#EEEDE9\](?![\w-])",      "bg-[#EEEDE9] dark:bg-neutral-800"),
    (r"(?<![:\w-])bg-\[#F5F4F0\](?![\w-])",      "bg-[#F5F4F0] dark:bg-neutral-800"),
    (r"(?<![:\w-])text-\[#666666\](?![\w-])",    "text-[#666666] dark:text-neutral-400"),
    (r"(?<![:\w-])text-\[#999999\](?![\w-])",    "text-[#999999] dark:text-neutral-500"),
]


def main():
    path = Path(sys.argv[1])
    src = path.read_text(encoding="utf-8")

    # Pre-count: how many of each pattern exist before transform
    pre_counts = {}
    for pat, _ in TRANSFORMS:
        pre_counts[pat] = len(re.findall(pat, src))

    # Apply transforms in order
    out = src
    for pat, repl in TRANSFORMS:
        out = re.sub(pat, repl, out)

    # Post-count: how many source tokens remain (= untouched), and how many
    # new dark variants exist (= transformed).
    post_remaining = {}
    post_dark = {
        "dark:bg-neutral-100":      0,
        "dark:border-neutral-50":   0,
        "dark:text-neutral-50":     0,
        "dark:bg-neutral-800":      0,
        "dark:text-neutral-400":    0,
        "dark:text-neutral-500":    0,
        "dark:hover:bg-neutral-800": 0,
    }

    for pat, _ in TRANSFORMS:
        post_remaining[pat] = len(re.findall(pat, out))
    for v in post_dark:
        post_dark[v] = out.count(v)

    # Write
    path.write_text(out, encoding="utf-8")

    # Report
    print(f"File: {path}")
    print()
    print(f"{'Pattern':<35} {'before':>7} {'after':>7} {'changed':>8}")
    print("-" * 60)
    for pat, _ in TRANSFORMS:
        b = pre_counts[pat]
        a = post_remaining[pat]
        print(f"{pat:<35} {b:>7} {a:>7} {b - a:>8}")
    print()
    print("Dark variants injected:")
    for v, c in post_dark.items():
        print(f"  {v}: {c}")


if __name__ == "__main__":
    main()
