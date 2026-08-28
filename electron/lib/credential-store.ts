// In-memory-only credential store. SMTP passwords/app-passwords never touch
// disk: not in the database, not in campaign folders, not in logs. They live
// here only for the lifetime of the running process and are gone on quit.

const passwords = new Map<string, string>();

export function setPassword(smtpProfileId: string, password: string): void {
  passwords.set(smtpProfileId, password);
}

export function getPassword(smtpProfileId: string): string | null {
  return passwords.get(smtpProfileId) ?? null;
}

export function clearPassword(smtpProfileId: string): void {
  passwords.delete(smtpProfileId);
}

export function hasPassword(smtpProfileId: string): boolean {
  return passwords.has(smtpProfileId);
}

export function clearAll(): void {
  passwords.clear();
}
