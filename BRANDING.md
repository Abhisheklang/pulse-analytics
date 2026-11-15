# Pulse Analytics — Branding

## Name

**Pulse Analytics** (spelled P-l-u-s-e). Display wordmark in the app chrome is the lowercase
`pulse`, mirroring the original product's lowercase wordmark styling; titles and documents use
"Pulse" / "Pulse Analytics".

## Tagline

**"Know your traffic. Guard their privacy."**

Used in: README header, page meta description (`src/app/layout.tsx`), and under the logo on
the login screen (`src/app/login/LoginForm.tsx`).

## Colour palette — "Midnight Pulse"

A deep blue/violet palette in the style of the trending palettes featured on colour-palette
sites such as Coolors. Rationale: blue is the colour most consistently associated with trust
and reliability in colour psychology — the register banks and analytics products live in —
while violet adds a sense of insight and premium quality, and the bright sky/teal accents keep
data visualisations energetic rather than corporate-dull.

| Role | Hex | Notes |
| --- | --- | --- |
| Primary (indigo) | `#4f46e5` | UI accent (`--zen-primary`), buttons, links, theme colour |
| Secondary (violet) | `#7c3aed` | Logo gradient end, second chart series |
| Deep navy (ink) | `#1e1b4b` | Palette anchor for dark text/surfaces |
| Sky accent | `#38bdf8` | Highlight accent (chart family) |
| Teal accent | `#14b8a6` | Positive/success accent (chart family) |

### Where the palette is applied

- `src/app/global.css` — `--zen-primary: #4f46e5` (the react-zen theme accent used by primary
  buttons, active states and links across the whole UI, light and dark).
- `src/lib/constants.ts` — `THEME_COLORS.primary` (light + dark) and the 12-colour
  `CHART_COLORS` dashboard scale: `#4f46e5, #7c3aed, #0ea5e9, #14b8a6, #f59e0b, #ec4899,
  #22c55e, #8b5cf6, #06b6d4, #f97316, #a3e635, #e879f9`.
- Logo gradient (`src/assets/logo.svg`), favicon set (`public/`), `site.webmanifest`
  `theme_color`, `browserconfig.xml` tile colour, and the `theme-color`/mask-icon metas in
  `src/app/layout.tsx`.

## Logo

Original mark: a **plus sign merged with a pulse/heartbeat line** — the vertical bar of the
plus runs through the spike of an ECG-style pulse line, on a rounded-square badge filled with
the indigo→violet diagonal gradient, glyph in white.

- `src/assets/logo.svg` — full-colour badge version (app logo; components in
  `src/components/svg/Logo.tsx`).
- `src/assets/logo-white.svg` — white/monochrome outline variant for dark backgrounds
  (`src/components/svg/LogoWhite.tsx`).
- Favicon set in `public/` (`favicon.ico`, 16/32 PNGs, apple-touch-icon, android-chrome
  192/512, mstile) rendered from the same mark; `public/safari-pinned-tab.svg` is the
  monochrome glyph-only variant Safari requires.

Note: `pnpm build:icons` (svgr) regenerates every icon component and currently emits a
different code style than the committed components, so `Logo.tsx`/`LogoWhite.tsx` were updated
by hand in the committed style rather than by wholesale regeneration.
