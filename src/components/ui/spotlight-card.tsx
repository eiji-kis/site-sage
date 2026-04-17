"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SpotlightCardProps = React.ComponentProps<"div">;

/**
 * Mouse-following radial highlight (React Bits–style “spotlight card”).
 * Wrap static server-rendered content; children stay RSC-friendly when passed from pages.
 */
export function SpotlightCard({ className, children, ...props }: SpotlightCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--spotlight-x", `${x}%`);
    el.style.setProperty("--spotlight-y", `${y}%`);
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.setProperty("--spotlight-x", "50%");
    el.style.setProperty("--spotlight-y", "50%");
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn(
        "group/spotlight relative overflow-hidden rounded-xl border border-border/70 bg-card/75 shadow-lg shadow-black/30 ring-1 ring-white/[0.07] backdrop-blur-md transition-[box-shadow,transform] duration-300 motion-safe:hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/40",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spotlight:opacity-100"
        style={{
          background:
            "radial-gradient(520px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), oklch(0.72 0.18 285 / 0.14), transparent 58%)",
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
