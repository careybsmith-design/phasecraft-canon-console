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
        <nav aria-label="Surfaces" className="flex items-center gap-4 text-sm">
          <Link to="/canon" className="ident text-primary">THREAD</Link>
          <Link to="/canon" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Canon</Link>
          <Link to="/graph" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Graph</Link>
          <Link to="/framing" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Framing</Link>
          <Link to="/fabric" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Fabric</Link>
          <Link to="/creation" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Creation</Link>
          <Link to="/shadow" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Shadow</Link>
          <Link to="/generation" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Generation</Link>
          <Link to="/evidence" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Evidence</Link>
          <Link to="/authority" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Authority</Link>
          <Link to="/decisions" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Decisions</Link>
        </nav>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="ident">{user?.email}</span>
          <button type="button" className="underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
