import { withBasePath } from "@/lib/paths";

type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

/** App mark — unified A2 clay mascot + CV (PWA / TWA / RuStore). */
export function BrandMark({ size = 48, className = "", decorative = true }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small brand mark; avoids layout shift in chrome
    <img
      src={withBasePath("/icon-192.png")}
      width={size}
      height={size}
      alt={decorative ? "" : "Calorie Vision"}
      className={`shrink-0 ${className}`.trim()}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      decoding="async"
    />
  );
}
