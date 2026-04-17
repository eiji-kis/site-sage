"use client";

import ShinyText from "@/components/ShinyText";

type BrandEyebrowProps = {
  text?: string;
  className?: string;
};

export function BrandEyebrow({ text = "Site Sage", className }: BrandEyebrowProps) {
  return (
    <ShinyText
      text={text}
      className={className ?? "text-xs font-semibold uppercase tracking-[0.2em]"}
      color="#9488b8"
      shineColor="#f4f0ff"
      speed={3.2}
      spread={118}
      pauseOnHover
    />
  );
}
