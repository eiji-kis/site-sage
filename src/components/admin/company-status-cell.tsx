import { Loader2 } from "lucide-react";

type CompanyStatus = "PENDING" | "COLLECTING" | "GENERATING" | "READY" | "FAILED";

const STATUS_LABEL: Record<CompanyStatus, string> = {
  PENDING: "Pending",
  COLLECTING: "Collecting",
  GENERATING: "Generating",
  READY: "Ready",
  FAILED: "Failed",
};

const STATUS_TONE: Record<CompanyStatus, string> = {
  PENDING: "bg-muted/50 text-muted-foreground ring-border/60",
  COLLECTING: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  GENERATING: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  READY: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  FAILED: "bg-destructive/15 text-destructive ring-destructive/30",
};

export function isInProgress(status: CompanyStatus): boolean {
  return status === "PENDING" || status === "COLLECTING" || status === "GENERATING";
}

export function CompanyStatusCell({
  status,
  progressStage,
  layout = "stacked",
}: {
  status: CompanyStatus;
  progressStage: string | null;
  layout?: "stacked" | "inline";
}) {
  const inProgress = isInProgress(status);
  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_TONE[status]}`}
    >
      {inProgress ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      {STATUS_LABEL[status]}
    </span>
  );

  if (layout === "inline") {
    return (
      <span className="inline-flex items-center gap-2">
        {badge}
        {inProgress && progressStage ? (
          <span className="text-xs text-muted-foreground">{progressStage}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {badge}
      {inProgress && progressStage ? (
        <span className="text-xs text-muted-foreground">{progressStage}</span>
      ) : null}
    </div>
  );
}
