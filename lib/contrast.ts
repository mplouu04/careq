/** Relative luminance and contrast helpers (WCAG 2.x). */

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fgHex: string, bgHex: string): number | null {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: 4.5:1 normal text, 3:1 large text. Theme colors are used with white UI chrome. */
export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3;

export function meetsWcagAa(
  fgHex: string,
  bgHex: string,
  largeText = false
): boolean {
  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio == null) return false;
  return ratio >= (largeText ? WCAG_AA_LARGE : WCAG_AA_NORMAL);
}

/** Theme accent must contrast with white foreground text at AA normal. */
export function themeColorMeetsAa(themeHex: string): boolean {
  return meetsWcagAa("#ffffff", themeHex, false);
}
