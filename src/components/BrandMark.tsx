import { withBasePath } from "@/lib/paths";

type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ size = 48, className = "", decorative = true }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBasePath("/logo.png")}
      alt={decorative ? "" : "Calorie Vision"}
      width={size}
      height={size}
      className={`shrink-0 ${className}`.trim()}
    />
  );
}
