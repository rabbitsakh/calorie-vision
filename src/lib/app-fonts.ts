import localFont from "next/font/local";

/**
 * Self-hosted variable fonts — deploy servers often get empty CSS from
 * fonts.googleapis.com (next/font/google then crashes on null match).
 */
export const bodyFont = localFont({
  src: "../fonts/Manrope-Variable.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "200 800",
});

export const displayFont = localFont({
  src: "../fonts/Unbounded-Variable.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "200 900",
});
