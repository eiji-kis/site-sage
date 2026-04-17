import { NewAgentForm } from "./new-agent-form";

/** Same as admin layout; repeated here so this route’s server action + `after()` pick up the limit reliably. */
export const maxDuration = 300;

export default function NewAgentPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          <span className="text-gradient-brand">New agent</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste the company name and the canonical website URL to begin.
        </p>
      </div>
      <NewAgentForm />
    </div>
  );
}
