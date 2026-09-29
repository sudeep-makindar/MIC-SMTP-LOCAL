import { useEffect, useState } from "react";
import type { Template, TemplateType } from "@shared/types";
import Modal from "../components/Modal";
import TemplateEditor from "../components/TemplateEditor";
import { confirmAction } from "../lib/dialogStore";
import { IconTemplates, IconTrash, IconPlus, IconUpload, IconFolder } from "../components/icons";

function extractTemplateName(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() || "";
  const withoutExt = base.replace(/\.[^/.]+$/, "");
  return withoutExt || base;
}

function detectTemplateType(filePath: string): TemplateType {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext === "txt" ? "text" : "html";
}

function getExtBadge(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase() || "file";
  if (ext === "hdb" || ext === "hbs") return { label: ext.toUpperCase(), className: "ext-badge-hdb" };
  if (ext === "html" || ext === "htm") return { label: "HTML", className: "ext-badge-html" };
  if (ext === "txt") return { label: "TXT", className: "ext-badge-txt" };
  return { label: ext.toUpperCase(), className: "ext-badge-txt" };
}

interface BulkTemplateItem {
  id: string;
  sourceFilePath: string;
  fileName: string;
  name: string;
  type: TemplateType;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showImport, setShowImport] = useState<"bulk" | "single" | null>(null);
  const [editorTarget, setEditorTarget] = useState<{ id: string | null } | null>(null);

  async function load() {
    setTemplates(await window.api.templates.list());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    const ok = await confirmAction("Campaigns already using it will keep their copy on disk. This can't be undone.", {
      title: "Delete this template?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await window.api.templates.delete(id);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">HTML, HDB, and plain-text templates available to campaigns</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => setShowImport("bulk")}>
            <IconUpload size={13} /> Bulk Import…
          </button>
          <button className="btn" onClick={() => setShowImport("single")}>
            Import from File…
          </button>
          <button className="btn btn-primary" onClick={() => setEditorTarget({ id: null })}>
            <IconPlus size={13} /> New Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">
              <IconTemplates size={26} />
            </div>
            <div>No templates yet. Import HDB, HTML, or plain-text templates to get started.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={() => setShowImport("bulk")}>
                <IconUpload size={13} /> Bulk Upload HDB / HTML
              </button>
              <button className="btn" onClick={() => setShowImport("single")}>
                Import Single Template
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-3">
          {templates.map((t) => (
            <div
              className="card card-pad"
              key={t.id}
              style={{ cursor: "pointer" }}
              onClick={() => setEditorTarget({ id: t.id })}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div className="text-muted" style={{ fontSize: 11.5, textTransform: "uppercase", marginTop: 2 }}>
                    {t.type === "html" ? "HTML" : "Plain Text"}
                    {t.assetsPath ? " · with assets" : ""}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                >
                  <IconTrash size={14} />
                </button>
              </div>
              <div className="divider" />
              <div className="hint" style={{ marginBottom: 6 }}>
                Detected placeholders
              </div>
              <div className="tag-list">
                {t.placeholders.length === 0 ? (
                  <span className="text-muted">None</span>
                ) : (
                  t.placeholders.map((p) => (
                    <span className="tag" key={p}>
                      {`{{${p}}}`}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <ImportTemplateModal
          initialMode={showImport}
          onClose={() => setShowImport(null)}
          onImported={() => {
            setShowImport(null);
            load();
          }}
        />
      )}

      {editorTarget && (
        <TemplateEditor
          templateId={editorTarget.id}
          onClose={() => setEditorTarget(null)}
          onSaved={() => {
            setEditorTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export function ImportTemplateModal({
  initialMode = "single",
  onClose,
  onImported,
}: {
  initialMode?: "bulk" | "single";
  onClose: () => void;
  onImported: () => void;
}) {
  const [mode, setMode] = useState<"bulk" | "single">(initialMode);

  // Single mode state
  const [name, setName] = useState("");
  const [userEditedName, setUserEditedName] = useState(false);
  const [type, setType] = useState<TemplateType>("html");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [assetsPath, setAssetsPath] = useState<string | null>(null);

  // Bulk mode state
  const [bulkItems, setBulkItems] = useState<BulkTemplateItem[]>([]);

  // General state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(paths: string[]) {
    if (!paths || paths.length === 0) return;
    setBulkItems((prev) => {
      const existing = new Set(prev.map((i) => i.sourceFilePath));
      const additions: BulkTemplateItem[] = [];
      for (const p of paths) {
        if (!existing.has(p)) {
          const fileName = p.split(/[/\\]/).pop() || p;
          additions.push({
            id: Math.random().toString(36).substring(2, 9),
            sourceFilePath: p,
            fileName,
            name: extractTemplateName(p),
            type: detectTemplateType(p),
          });
          existing.add(p);
        }
      }
      return [...prev, ...additions];
    });
  }

  async function handlePickBulkFiles() {
    setError(null);
    const files = await window.api.templates.pickBulkFiles();
    if (files && files.length > 0) {
      addFiles(files);
    }
  }

  async function handlePickFolder() {
    setError(null);
    const files = await window.api.templates.pickFolder();
    if (files && files.length > 0) {
      addFiles(files);
    } else if (files) {
      setError("No valid template files (.hdb, .html, .hbs, .txt) were found in the selected folder.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const paths = files.map((f: any) => f.path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      if (mode === "single") {
        const p = paths[0];
        setFilePath(p);
        setType(detectTemplateType(p));
        if (!userEditedName || !name.trim()) {
          setName(extractTemplateName(p));
        }
      } else {
        addFiles(paths);
      }
    }
  }

  function updateBulkItemName(id: string, newName: string) {
    setBulkItems((prev) => prev.map((item) => (item.id === id ? { ...item, name: newName } : item)));
  }

  function updateBulkItemType(id: string, newType: TemplateType) {
    setBulkItems((prev) => prev.map((item) => (item.id === id ? { ...item, type: newType } : item)));
  }

  function removeBulkItem(id: string) {
    setBulkItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function pickSingleFile() {
    setError(null);
    const path = type === "html" ? await window.api.templates.pickHtmlFile() : await window.api.templates.pickTextFile();
    if (path) {
      setFilePath(path);
      const autoType = detectTemplateType(path);
      setType(autoType);
      if (!userEditedName || !name.trim()) {
        setName(extractTemplateName(path));
      }
    }
  }

  async function pickAssets() {
    const path = await window.api.templates.pickAssetsFolder();
    if (path) setAssetsPath(path);
  }

  async function submitSingle() {
    if (!name.trim() || !filePath) {
      setError("Template name and file are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.api.templates.import({
        name: name.trim(),
        type,
        sourceFilePath: filePath,
        assetsFolderPath: assetsPath,
      });
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitBulk() {
    if (bulkItems.length === 0) {
      setError("Please select at least one template file to import.");
      return;
    }
    const emptyName = bulkItems.find((i) => !i.name.trim());
    if (emptyName) {
      setError(`Please provide a template name for "${emptyName.fileName}".`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.api.templates.bulkImport(
        bulkItems.map((item) => ({
          name: item.name.trim(),
          type: item.type,
          sourceFilePath: item.sourceFilePath,
        }))
      );
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === "bulk" ? "Bulk Import Templates" : "Import Template"}
      wide={mode === "bulk"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {mode === "bulk" ? (
            <button
              className="btn btn-primary"
              onClick={submitBulk}
              disabled={busy || bulkItems.length === 0}
            >
              {busy
                ? "Importing Templates…"
                : `Import ${bulkItems.length} Template${bulkItems.length === 1 ? "" : "s"}`}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={submitSingle}
              disabled={busy || !filePath || !name.trim()}
            >
              {busy ? "Importing…" : "Import Template"}
            </button>
          )}
        </>
      }
    >
      {/* Mode Switcher Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${mode === "bulk" ? "active" : ""}`}
          onClick={() => {
            setMode("bulk");
            setError(null);
          }}
        >
          <IconUpload size={14} /> Bulk Upload (HDB / HTML / Text)
        </button>
        <button
          className={`tab-btn ${mode === "single" ? "active" : ""}`}
          onClick={() => {
            setMode("single");
            setError(null);
          }}
        >
          Single Template
        </button>
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}

      {mode === "bulk" ? (
        <div>
          {/* Upload Dropzone */}
          <div
            className={`upload-zone ${isDragging ? "dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={handlePickBulkFiles}
          >
            <div className="upload-zone-icon">
              <IconUpload size={20} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
              Click to select template files, or drag and drop here
            </div>
            <div className="hint" style={{ marginBottom: 14 }}>
              Supports <strong style={{ color: "var(--text-0)" }}>.hdb</strong>, <strong style={{ color: "var(--text-0)" }}>.html</strong>, <strong style={{ color: "var(--text-0)" }}>.hbs</strong>, and <strong style={{ color: "var(--text-0)" }}>.txt</strong> files
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-primary btn-sm" onClick={handlePickBulkFiles}>
                <IconUpload size={13} /> Select Files…
              </button>
              <button className="btn btn-sm" onClick={handlePickFolder}>
                <IconFolder size={13} /> Select Entire Folder…
              </button>
            </div>
          </div>

          {/* Bulk Items List */}
          {bulkItems.length > 0 && (
            <div className="bulk-items-container">
              <div className="bulk-items-header">
                <span>{bulkItems.length} Templates Ready to Import</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-ghost btn-sm" onClick={handlePickBulkFiles}>
                    + Add Files
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handlePickFolder}>
                    + Add Folder
                  </button>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => setBulkItems([])}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="bulk-items-list">
                {bulkItems.map((item, idx) => {
                  const badge = getExtBadge(item.fileName);
                  return (
                    <div className="bulk-item-row" key={item.id}>
                      <span className={`ext-badge ${badge.className}`}>{badge.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span
                            className="text-muted"
                            style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={item.sourceFilePath}
                          >
                            {item.fileName}
                          </span>
                        </div>
                        <input
                          value={item.name}
                          onChange={(e) => updateBulkItemName(item.id, e.target.value)}
                          placeholder="Template Name"
                          style={{ width: "100%", padding: "5px 9px", fontSize: 12.5 }}
                        />
                      </div>
                      <div style={{ width: 100, flexShrink: 0 }}>
                        <select
                          value={item.type}
                          onChange={(e) => updateBulkItemType(item.id, e.target.value as TemplateType)}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 12 }}
                        >
                          <option value="html">HTML</option>
                          <option value="text">Plain Text</option>
                        </select>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeBulkItem(item.id)}
                        title="Remove from batch"
                        style={{ padding: "4px 8px", color: "var(--text-3)" }}
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {bulkItems.length > 0 && (
            <div className="hint" style={{ marginTop: 10 }}>
              💡 Template names are prefilled from filenames. You can edit any name before clicking Import.
            </div>
          )}
        </div>
      ) : (
        /* Single File Mode */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Template Name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setUserEditedName(true);
              }}
              placeholder="e.g. Event Certificate"
            />
            <div className="hint">Automatically generated from the file name. You can edit it if you want.</div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`btn ${type === "html" ? "btn-primary" : ""}`}
                onClick={() => {
                  setType("html");
                  setFilePath(null);
                }}
              >
                HTML / HDB
              </button>
              <button
                className={`btn ${type === "text" ? "btn-primary" : ""}`}
                onClick={() => {
                  setType("text");
                  setFilePath(null);
                }}
              >
                Plain Text
              </button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>{type === "html" ? "Template File (.hdb, .html, .hbs)" : "Text File (.txt)"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={pickSingleFile}>
                Choose File…
              </button>
              <div
                className="hint"
                style={{
                  alignSelf: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 340,
                }}
              >
                {filePath ?? "No file selected (or drag and drop here)"}
              </div>
            </div>
          </div>

          {type === "html" && (
            <div className="field">
              <label>Assets Folder (optional)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={pickAssets}>
                  Choose Folder…
                </button>
                <div className="hint" style={{ alignSelf: "center" }}>
                  {assetsPath ?? "No folder selected"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
