// Muted SMPTE bars. Decorative period detail only: strips of 4 to 6px
// and the master monitor test card. Never used for UI meaning.
export const SMPTE_COLORS = [
  "#9A9A8E",
  "#A8A85E",
  "#6EA8A8",
  "#6EA86E",
  "#A86EA8",
  "#A86E6E",
  "#6E6EA8",
] as const;

export const SMPTE_GRADIENT = `linear-gradient(to right, ${SMPTE_COLORS.map(
  (color, i) =>
    `${color} ${(i / SMPTE_COLORS.length) * 100}% ${((i + 1) / SMPTE_COLORS.length) * 100}%`,
).join(", ")})`;
