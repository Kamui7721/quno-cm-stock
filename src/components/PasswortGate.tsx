import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { einloggen, istEingeloggt } from "@/lib/gate";
import { AppShell } from "./AppShell";
import { Button, Input } from "./ui-kit";

export function PasswortGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    setOk(istEingeloggt());
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-background" />;

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (einloggen(pw)) setOk(true);
            else setFehler(true);
          }}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-7"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Lock size={20} />
            </div>
            <div className="text-lg font-semibold text-foreground">QUNO x CM</div>
            <div className="text-xs font-medium text-primary">Inventur</div>
          </div>
          <Input
            type="password"
            autoFocus
            value={pw}
            placeholder="Passwort"
            onChange={(e) => {
              setPw(e.target.value);
              setFehler(false);
            }}
          />
          {fehler && <p className="mt-2 text-xs text-primary">Falsches Passwort.</p>}
          <Button type="submit" className="mt-4 w-full">
            Anmelden
          </Button>
        </form>
      </div>
    );
  }

  return <AppShell onLogout={() => setOk(false)}>{children}</AppShell>;
}