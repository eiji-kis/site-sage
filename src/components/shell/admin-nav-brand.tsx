"use client";

import Link from "next/link";

import ShinyText from "@/components/ShinyText";

export function AdminNavBrand() {
  return (
    <Link
      href="/admin"
      className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
    >
      <ShinyText
        text="Site Sage"
        className="text-sm font-semibold tracking-tight"
        color="#a19bb8"
        shineColor="#f5f3ff"
        speed={4.5}
        spread={125}
        pauseOnHover
      />
      <span className="text-sm font-medium text-muted-foreground">
        | powered by KIS Solutions
      </span>
    </Link>
  );
}
