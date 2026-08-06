const KEY = "quno_auth";
const PW_KEY = "quno_pw";
export const STANDARD_PASSWORT = "clubmichel2026";

export function aktuellesPasswort(): string {
  if (typeof window === "undefined") return STANDARD_PASSWORT;
  return localStorage.getItem(PW_KEY) ?? STANDARD_PASSWORT;
}

export function setzePasswort(pw: string) {
  localStorage.setItem(PW_KEY, pw);
}

export function istEingeloggt(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}

export function einloggen(pw: string): boolean {
  if (pw === aktuellesPasswort()) {
    sessionStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}

export function ausloggen() {
  sessionStorage.removeItem(KEY);
}