// Der Passwortschutz wird serverseitig geprüft (/api/public/session).
// Im Browser liegt nur ein HttpOnly-Cookie, kein Passwort und kein Datenbankzugriff.
const ENDPOINT = "/api/public/session";

export async function istEingeloggt(): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, { credentials: "same-origin" });
    const body = (await res.json()) as { ok?: boolean };
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}

export async function einloggen(pw: string): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passwort: pw }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}

export async function ausloggen() {
  try {
    await fetch(ENDPOINT, { method: "DELETE", credentials: "same-origin" });
  } catch {
    // ignorieren
  }
}