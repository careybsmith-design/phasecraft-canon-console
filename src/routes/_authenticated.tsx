import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  if (loading || !session) return <p className="p-6 text-muted-foreground">Checking session…</p>;
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <Link to="/canon" className="ident text-primary">THREAD</Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="ident">{user?.email}</span>
          <button type="button" className="underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
