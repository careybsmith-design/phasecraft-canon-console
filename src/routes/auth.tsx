import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · THREAD" },
      { name: "description", content: "Sign in to THREAD, the MASA Global operating graph." },
      { property: "og:title", content: "Sign in · THREAD" },
      { property: "og:description", content: "Sign in to THREAD, the MASA Global operating graph." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/canon" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/canon" } });
    setBusy(false);
    if (res.error) setMsg(res.error.message);
    else if (mode === "up" && !res.data.session) setMsg("Check your email to confirm the account.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg(r.error.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="ident text-primary">THREAD</p>
          <h1 className="mt-1 text-lg font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
