import { withBasePath } from "@/lib/paths";

type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

/**
 * In-app brand mark — A2 mascot + CV on transparent background.
 * App icons (PWA/TWA/RuStore) stay on opaque plates in /icon-*.png.
 */
export function BrandMark({ size = 56, className = "", decorative = true }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small brand mark; avoids layout shift in chrome
    <img
      src={withBasePath("/brand-mark.png?v=1.12.2")}
      width={size}
      height={size}
      alt={decorative ? "" : "Calorie Vision"}
      className={`shrink-0 object-contain ${className}`.trim()}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      decoding="async"
    />
  );
}
