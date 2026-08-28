import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Template, TemplateType } from "../../shared/types";

interface TemplateRow {
  id: string;
  name: string;
  type: string;
  body_path: string;
  assets_path: string | null;
  placeholders: string;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    name: r.name,
    type: r.type as TemplateType,
    bodyPath: r.body_path,
    assetsPath: r.assets_path,
    placeholders: JSON.parse(r.placeholders || "[]"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createTemplate(
  name: string,
  type: TemplateType,
  bodyPath: string,
  assetsPath: string | null,
  placeholders: string[]
): Template {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO templates (id, name, type, body_path, assets_path, placeholders, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, type, bodyPath, assetsPath, JSON.stringify(placeholders), now, now);
  return getTemplate(id)!;
}

export function getTemplate(id: string): Template | null {
  const row = getDb().prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as unknown as TemplateRow | undefined;
  return row ? rowToTemplate(row) : null;
}

export function listTemplates(): Template[] {
  const rows = getDb().prepare(`SELECT * FROM templates ORDER BY updated_at DESC`).all() as unknown as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function updateTemplatePlaceholders(id: string, placeholders: string[]): void {
  getDb()
    .prepare(`UPDATE templates SET placeholders = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(placeholders), new Date().toISOString(), id);
}

export function updateTemplateMeta(id: string, name: string, placeholders: string[]): Template {
  getDb()
    .prepare(`UPDATE templates SET name = ?, placeholders = ?, updated_at = ? WHERE id = ?`)
    .run(name, JSON.stringify(placeholders), new Date().toISOString(), id);
  return getTemplate(id)!;
}

export function deleteTemplate(id: string): void {
  getDb().prepare(`DELETE FROM templates WHERE id = ?`).run(id);
}
