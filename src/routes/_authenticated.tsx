import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TEST_MODE } from "@/lib/test-mode";
import { ensureTestStewardRole } from "@/lib/test-mode.functions";
import { Button } from "@/components/ui/button";
import { CompanionPanel } from "@/components/human-surfaces";
import {
  Compass,
  Activity,
  Flag,
  FlaskConical,
  BookOpen,
  Network,
  ScanLine,
  Boxes,
  Hammer,
  Layers,
  FileText,
  Bot,
  ShieldCheck,
  Radar,
  ChartNoAxesCombined,
  GitBranch,
  KeyRound,
  ListChecks,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

const surfaces = [
  { to: "/feed", label: "Feed", icon: Activity },
  { to: "/missions", label: "Missions", icon: Flag },
  { to: "/simulate", label: "Simulation", icon: FlaskConical },
  { to: "/canon", label: "Canon", icon: BookOpen },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/framing", label: "Framing", icon: ScanLine },
  { to: "/fabric", label: "Fabric", icon: Boxes },
  { to: "/creation", label: "Creation", icon: Hammer },
  { to: "/shadow", label: "Shadow", icon: Layers },
  { to: "/generation", label: "Generation", icon: FileText },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/assurance", label: "Assurance", icon: ShieldCheck },
  { to: "/detectors", label: "Detection", icon: Radar },
  { to: "/measurement", label: "Measurement", icon: ChartNoAxesCombined },
  { to: "/evidence", label: "Evidence", icon: GitBranch },
  { to: "/authority", label: "Authority", icon: KeyRound },
  { to: "/decisions", label: "Decisions", icon: ListChecks },
] as const;

function AuthedLayout() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const [companionOpen, setCompanionOpen] = useState(false);
  const [testSigningIn, setTestSigningIn] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    if (loading || session) return;
    if (!TEST_MODE) {
      navigate({ to: "/auth" });
      return;
    }
    // TEST MODE: hand the browser a disposable anonymous session instead of
    // the sign-in page, so every record still carries a verified actor.
    if (testSigningIn) return;
    setTestSigningIn(true);
    supabase.auth
      .signInAnonymously()
      .then(async ({ error }) => {
        if (error) {
          setTestSigningIn(false);
          navigate({ to: "/auth" });
          return;
        }
        try {
          await ensureTestStewardRole();
        } catch (roleError) {
          console.error("Test-mode steward grant failed", roleError);
        }
      })
      .catch(() => {
        setTestSigningIn(false);
        navigate({ to: "/auth" });
      });
  }, [loading, session, navigate, testSigningIn]);
  if (loading || !session) {
    return (
      <p className="p-6 text-muted-foreground">
        {TEST_MODE && testSigningIn ? "Preparing test session…" : "Checking session…"}
      </p>
    );
  }
  return (
    <div className="thread-shell">
      <header className="thread-navigation">
        <Link to="/feed" className="thread-brand">
          THREAD
        </Link>
        <nav aria-label="Surfaces" className="thread-nav">
          {surfaces.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="thread-nav-link">
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="thread-account">
          <span className="thread-account-email">{user?.email}</span>
          <Sheet open={companionOpen} onOpenChange={setCompanionOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Open Value Companion"
                title="Value Companion"
              >
                <Compass size={18} />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-auto sm:max-w-lg">
              <SheetTitle className="sr-only">Value Companion</SheetTitle>
              <CompanionPanel docked />
            </SheetContent>
          </Sheet>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              await navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
        <span className="thread-account-email-mobile">{user?.email}</span>
      </header>
      <div className="thread-workspace">
        <Outlet />
      </div>
    </div>
  );
}
