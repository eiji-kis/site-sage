import Link from "next/link";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export default function CompanyNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <SpotlightCard className="w-full px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-gradient-brand">Chat not available</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This company chat is missing or still processing. Check the link or try again later.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back home
        </Link>
      </SpotlightCard>
    </div>
  );
}
