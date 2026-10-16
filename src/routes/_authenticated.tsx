import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CompanionPanel } from "@/components/human-surfaces";
import { Compass } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const [companionOpen, setCompanionOpen] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);
  if (loading || !session) return <p className="p-6 text-muted-foreground">Checking session…</p>;
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <nav aria-label="Surfaces" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link to="/feed" className="ident text-primary">THREAD</Link>
          <Link to="/feed" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Feed</Link>
          <Link to="/missions" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Missions</Link>
          <Link to="/simulate" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Simulation</Link>
          <Link to="/canon" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Canon</Link>
          <Link to="/graph" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Graph</Link>
          <Link to="/framing" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Framing</Link>
          <Link to="/fabric" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Fabric</Link>
          <Link to="/creation" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Creation</Link>
          <Link to="/shadow" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Shadow</Link>
          <Link to="/generation" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Generation</Link>
          <Link to="/agents" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Agents</Link>
          <Link to="/detectors" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Detection</Link>
          <Link to="/measurement" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Measurement</Link>
          <Link to="/evidence" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Evidence</Link>
          <Link to="/authority" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Authority</Link>
          <Link to="/decisions" className="text-muted-foreground" activeProps={{ className: "text-foreground" }}>Decisions</Link>
        </nav>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="ident">{user?.email}</span>
          <Sheet open={companionOpen} onOpenChange={setCompanionOpen}><SheetTrigger asChild><Button size="icon" variant="ghost" aria-label="Open Value Companion" title="Value Companion"><Compass size={18} /></Button></SheetTrigger><SheetContent className="w-full overflow-auto sm:max-w-lg"><SheetTitle className="sr-only">Value Companion</SheetTitle><CompanionPanel docked /></SheetContent></Sheet>
          <Button size="sm" variant="ghost" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: "/auth", replace: true }); }}>Sign out</Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
