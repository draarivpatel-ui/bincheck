# BinCheck Design System: Swiss Civic Industrial & Material Specification Sheet

## 1. Concept Card

- **Visual World:** Swiss Civic Industrial & Material Specification Sheet
- **Design Intent:** `Operate` + `Persuade` (a high-craft municipal utility and material recovery specification sheet built for Fort Bend County and Greater Houston households)
- **Physical References:**
  1. Republic Services and City of Houston SWMD injection-molded high-density polyethylene (`#2 HDPE`) roll-out carts
  2. Fort Bend County Recycling Center (1200 Blume Rd) industrial material recovery specification placards and bale-grade sheets
  3. GS1 UPC-A / EAN-13 packaging print proofs and SPI resin identification mold stamps (`#1` through `#7`)
- **Motion Verb:** *"Snap like a sorting gate"* - optical Near-Infrared (NIR) air-classification jets and mechanical MRF diverter gates actuate with crisp, decisive, low-latency precision (`cubic-bezier(0.16, 1, 0.3, 1)`).

## 2. Color Palette & Surface Tokens

Derived from unbleached recycled newsprint stock, deep forest-ink stencil typography, and municipal cart pigments. All text pairings exceed WCAG AA (`4.5:1` for body copy, `3:1` for large display type).

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--ground` | `#F5F3EC` | Recycled newsprint primary canvas |
| `--surface` | `#FDFCF8` | Warm specification sheet card surface |
| `--surface-alt` | `#EAE6DA` | Milled pulp secondary well and control track |
| `--ink` | `#0E1B16` | Deep forest-ink primary typography |
| `--muted` | `#3D5249` | Tinted secondary specification copy (passes AA on `--ground` and `--surface`) |
| `--line` | `#CEC9B8` | 1px technical grid hairlines (`~16%` ink density) |
| `--line-strong` | `#0E1B16` | Structural index rule |
| `--accent` | `#047857` | Municipal Cart Emerald (primary action, valid UPC, curbside acceptance) |
| `--accent-hover` | `#065F46` | Deepened cart emerald for active/hover states |
| `--accent-Wash` | `#D1FAE5` | Tinted emerald surface for accepted stream badges |
| `--amber` | `#D97706` | Contamination Amber (split disposal, grease/liquid preparation warning) |
| `--amber-wash` | `#FEF3C7` | Tinted amber surface for moderate/high contamination notices |
| `--hazard` | `#DC2626` | Hazard Crimson (MRF shaft tanglers, lithium thermal runaway, rejected loads) |
| `--hazard-wash` | `#FEE2E2` | Tinted crimson surface for prohibited curbside items |

## 3. Typography & Hierarchy

- **Primary Sans (`--font-sans`):** `'Space Grotesk'`, fallback `-apple-system, BlinkMacSystemFont, sans-serif`. Carries structural headings, municipal tables, and control labels with tight display tracking (`-0.03em`) and clear weight contrast (`500` vs `700`).
- **Editorial Accent (`--font-serif`):** `'Instrument Serif'` italic, used selectively inside the primary display statement to contrast civic authority with human touch.
- **Technical Monospace (`--font-mono`):** `'JetBrains Mono'`, fallback `ui-monospace, SFMono-Regular, monospace`. Reserved strictly for GS1 Modulo-10 barcodes, SPI resin codes (`#1` to `#7`), contamination scores (`0-100`), weight limits (`40 lb` / `50 lb`), and facility street coordinates.
- **Numeric Discipline:** `font-variant-numeric: tabular-nums` enforced across all barcode inputs, contamination gauges, batch counters, and ordinance tables.

## 4. Layout Architecture & Craft Floor Rules

1. **Four-Corners Civic Frame:** Top-left displays the `BinCheck` specification mark and ordinance edition; top-right houses the jurisdiction switcher (`Sugar Land, TX`, `Houston, TX`, `Side-by-Side Comparison`); bottom-left anchors Fort Bend / Houston SWMD facility coordinates; bottom-right provides the one-click 1-page kitchen print action.
2. **Tactile Barcode & Polymer Deck:** Combines a GS1 Modulo-10 optical laser scan-line sweep on lookup with an interactive 7-polymer SPI resin selector (`#1 PETE` through `#7 Other`), custom stroke-matched SVG chasing-arrows and hazard icons, and an MRF optical sorter schematic (`img/hero-materials.png` with an inline SVG technical diagram fallback).
3. **Interactive Cart Contamination Gauge:** Replaces generic progress bars with a calibrated 0-100 MRF risk scale marking the exact thresholds for `LOW` (`0-24`), `MODERATE` (`25-54`), `HIGH` (`55-84`), and `CRITICAL` (`85-100`) facility rejection.
4. **Anti-Slop Guarantees:** Zero em-dashes or en-dashes, zero uppercase eyebrow kickers above headings, zero emoji icons (100% custom inline SVGs with consistent `1.75px` stroke weight), zero `border-left` stripes thicker than `1px`, and full browser surface theming (`::selection`, `::-webkit-scrollbar`, `:focus-visible`, `@media print`, and `@media (prefers-reduced-motion: reduce)`).
