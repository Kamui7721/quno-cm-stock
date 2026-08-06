import { createHmac, timingSafeEqual } from "crypto";
import { getRequest } from "@tanstack/react-start/server";

export const GATE_COOKIE = "quno_gate";
export const GATE_MAX_AGE = 60 * 60 * 12;

function standardPasswort(): string {
  return process.env["APP_PASSWORT"] ?? "clubmichel2026";
}

function signierSchluessel(): string {
  return (
    process.env["APP_SESSION_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_DB_URL"] ??
    "quno-cm-dev-secret"
  );
}

function tokenFuer(passwort: string): string {
  return createHmac("sha256", signierSchluessel())
    .update(`quno-gate-v1|${passwort}`)
    .digest("hex");
}

function gleich(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Erzeugt ein Session-Token, wenn das Passwort stimmt — sonst null. */
export function sessionToken(passwort: string): string | null {
  const erwartet = tokenFuer(standardPasswort());
  const gegeben = tokenFuer(passwort);
  return gleich(gegeben, erwartet) ? erwartet : null;
}

function cookieWert(name: string, header: string | null): string | null {
  if (!header) return null;
  for (const teil of header.split(";")) {
    const [k, ...rest] = teil.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function tokenAusHeader(cookieHeader: string | null): string | null {
  return cookieWert(GATE_COOKIE, cookieHeader);
}

export function tokenGueltig(token: string | null): boolean {
  if (!token) return false;
  return gleich(token, tokenFuer(standardPasswort()));
}

/** Wirft, wenn die Anfrage keine gültige Passwort-Session mitbringt. */
export function assertGate(): void {
  const request = getRequest();
  const token = tokenAusHeader(request?.headers?.get("cookie") ?? null);
  if (!tokenGueltig(token)) {
    throw new Error("Nicht angemeldet");
  }
}

// SameSite=None, damit die Session auch in der eingebetteten Vorschau
// (App läuft dort in einem iframe) mitgesendet wird. Secure + HttpOnly bleiben.
export function setCookieHeader(token: string): string {
  return `${GATE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${GATE_MAX_AGE}`;
}

export function clearCookieHeader(): string {
  return `${GATE_COOKIE}=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0`;
}