// Kein User-System: der Anzeigename für Prüfvermerke wird lokal gespeichert.
const KEY = "quno_benutzer";
const STANDARD = "Club Michel";

export function benutzerName(): string {
  if (typeof window === "undefined") return STANDARD;
  return window.localStorage.getItem(KEY)?.trim() || STANDARD;
}

export function benutzerNameSetzen(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name.trim());
}
