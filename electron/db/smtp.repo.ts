import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { SmtpProfile, SmtpSecurity } from "../../shared/types";

interface SmtpRow {
  id: string;
  name: string;
  host: string;
  port: number;
  security: string;
  username: string;
  from_name: string;
  from_email: string;
  created_at: string;
  updated_at: string;
}

function rowToProfile(r: SmtpRow): SmtpProfile {
  return {
    id: r.id,
    name: r.name,
    host: r.host,
    port: r.port,
    security: r.security as SmtpSecurity,
    username: r.username,
    fromName: r.from_name,
    fromEmail: r.from_email,
  };
}

export interface SmtpProfileInput {
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromName: string;
  fromEmail: string;
}

export function upsertSmtpProfile(input: SmtpProfileInput, id?: string): SmtpProfile {
  const db = getDb();
  const now = new Date().toISOString();
  if (id) {
    db.prepare(
      `UPDATE smtp_profiles SET name=?, host=?, port=?, security=?, username=?, from_name=?, from_email=?, updated_at=? WHERE id=?`
    ).run(input.name, input.host, input.port, input.security, input.username, input.fromName, input.fromEmail, now, id);
    return getSmtpProfile(id)!;
  }
  const newId = uuid();
  db.prepare(
    `INSERT INTO smtp_profiles (id, name, host, port, security, username, from_name, from_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId, input.name, input.host, input.port, input.security, input.username, input.fromName, input.fromEmail, now, now);
  return getSmtpProfile(newId)!;
}

export function getSmtpProfile(id: string): SmtpProfile | null {
  const row = getDb().prepare(`SELECT * FROM smtp_profiles WHERE id = ?`).get(id) as unknown as SmtpRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function listSmtpProfiles(): SmtpProfile[] {
  const rows = getDb().prepare(`SELECT * FROM smtp_profiles ORDER BY updated_at DESC`).all() as unknown as SmtpRow[];
  return rows.map(rowToProfile);
}

export function deleteSmtpProfile(id: string): void {
  getDb().prepare(`DELETE FROM smtp_profiles WHERE id = ?`).run(id);
}
