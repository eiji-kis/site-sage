import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/actions/auth-actions";
import { AdminNavBrand } from "@/components/shell/admin-nav-brand";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <AdminNavBrand />
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/admin" className="hover:text-foreground">
                Companies
              </Link>
              <Link href="/admin/agents/new" className="hover:text-foreground">
                New agent
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</main>
    </div>
  );
}
