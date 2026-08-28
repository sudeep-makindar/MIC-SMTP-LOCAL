import { useEffect, useState } from "react";
import type { Template, TemplateType } from "@shared/types";
import Modal from "../components/Modal";
import TemplateEditor from "../components/TemplateEditor";
import { confirmAction } from "../lib/dialogStore";
import { IconTemplates, IconTrash, IconPlus } from "../components/icons";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showImport, setShowImport] = useState(false);
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
          <p className="page-subtitle">HTML and plain-text templates available to campaigns</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => setShowImport(true)}>
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
            <div>No templates yet. Import an HTML or plain-text template to get started.</div>
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
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
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

function ImportTemplateModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("html");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [assetsPath, setAssetsPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const path = type === "html" ? await window.api.templates.pickHtmlFile() : await window.api.templates.pickTextFile();
    if (path) setFilePath(path);
  }

  async function pickAssets() {
    const path = await window.api.templates.pickAssetsFolder();
    if (path) setAssetsPath(path);
  }

  async function submit() {
    if (!name.trim() || !filePath) {
      setError("Template name and file are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.api.templates.import({ name: name.trim(), type, sourceFilePath: filePath, assetsFolderPath: assetsPath });
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import Template"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </button>
        </>
      }
    >
      {error && <div className="banner banner-danger">{error}</div>}
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Template Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Event Certificate" />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Type</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${type === "html" ? "btn-primary" : ""}`} onClick={() => { setType("html"); setFilePath(null); }}>
            HTML
          </button>
          <button className={`btn ${type === "text" ? "btn-primary" : ""}`} onClick={() => { setType("text"); setFilePath(null); }}>
            Plain Text
          </button>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>{type === "html" ? "HTML File" : "Text File"}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={pickFile}>
            Choose File…
          </button>
          <div className="hint" style={{ alignSelf: "center" }}>
            {filePath ?? "No file selected"}
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
    </Modal>
  );
}
