import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut, Plus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

function Layout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);
  if (!user) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-28">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background/90 px-4 py-4 backdrop-blur">
        <Link to="/dashboard"><Logo /></Link>
        <button aria-label="Sign out" className="rounded-full p-2 text-muted-foreground hover:bg-muted" onClick={() => supabase.auth.signOut()}>
          <LogOut className="h-5 w-5" />
        </button>
      </header>
      <Outlet />
      <Link to="/new" className="fixed bottom-6 left-1/2 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-hero px-6 font-semibold text-primary-foreground shadow-card">
        <Plus className="h-5 w-5" /> New split
      </Link>
    </div>
  );
}
