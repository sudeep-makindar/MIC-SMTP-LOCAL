import { useEffect, useRef, useState } from "react";
import type { Template, TemplateType } from "@shared/types";
import { promptText } from "../lib/dialogStore";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
function detectPlaceholdersClient(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(text)) !== null) found.add(m[1]);
  return Array.from(found).sort();
}

const COMMON_PLACEHOLDERS = ["name", "email", "event_name", "certificate_id"];

export default function TemplateEditor({
  templateId,
  onClose,
  onSaved,
}: {
  templateId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = templateId === null;
  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("html");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const htmlRef = useRef<HTMLDivElement>(null);
  const [textBody, setTextBody] = useState("Hello {{name}},\n\nWrite your message here.");
  const [placeholders, setPlaceholders] = useState<string[]>([]);

  useEffect(() => {
    if (isNew) {
      if (htmlRef.current) htmlRef.current.innerHTML = "<p>Hello {{name}},</p><p>Write your message here.</p>";
      return;
    }
    window.api.templates.read(templateId!).then((t) => {
      if (!t) return;
      setName(t.name);
      setType(t.type);
      if (t.type === "html") {
        setTimeout(() => {
          if (htmlRef.current) htmlRef.current.innerHTML = t.body;
        }, 0);
      } else {
        setTextBody(t.body);
      }
      setPlaceholders(t.placeholders);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function currentBody(): string {
    return type === "html" ? htmlRef.current?.innerHTML ?? "" : textBody;
  }

  function syncPlaceholders() {
    setPlaceholders(detectPlaceholdersClient(currentBody()));
  }

  function exec(command: string, value?: string) {
    htmlRef.current?.focus();
    document.execCommand(command, false, value);
    syncPlaceholders();
  }

  async function insertLink() {
    const url = await promptText({ title: "Insert link", placeholder: "https://example.com", confirmLabel: "Insert" });
    if (!url) return;
    exec("createLink", url);
  }

  async function insertPlaceholder(key: string) {
    const token = `{{${key}}}`;
    if (type === "html") {
      exec("insertText", token);
      return;
    }
    const el = textareaRef.current;
    if (!el) {
      setTextBody((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? textBody.length;
    const end = el.selectionEnd ?? textBody.length;
    const next = textBody.slice(0, start) + token + textBody.slice(end);
    setTextBody(next);
    setPlaceholders(detectPlaceholdersClient(next));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function save() {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.api.templates.save({
        id: templateId,
        name: name.trim(),
        type,
        body: currentBody(),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box wide" style={{ width: 820 }}>
        <div className="modal-header">
          <h3>{isNew ? "New Template" : "Edit Template"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="banner banner-danger">{error}</div>}

          <div className="field-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label>Template Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Event Certificate" />
            </div>
            {isNew && (
              <div className="field" style={{ maxWidth: 220 }}>
                <label>Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`btn btn-sm ${type === "html" ? "btn-primary" : ""}`} onClick={() => setType("html")}>
                    HTML
                  </button>
                  <button className={`btn btn-sm ${type === "text" ? "btn-primary" : ""}`} onClick={() => setType("text")}>
                    Plain Text
                  </button>
                </div>
              </div>
            )}
          </div>

          {type === "text" ? (
            <div className="banner banner-info">
              Plain-text emails have no bold, italic, or styling — every email client renders this exactly as typed,
              including symbols like ** or _. If you need formatted text, use an HTML template instead.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} style={{ fontWeight: 800 }}>
                B
              </button>
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} style={{ fontStyle: "italic" }}>
                I
              </button>
              <button
                className="btn btn-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => exec("underline")}
                style={{ textDecoration: "underline" }}
              >
                U
              </button>
              <span style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
                • List
              </button>
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}>
                1. List
              </button>
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}>
                Link
              </button>
              <button className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}>
                Clear
              </button>
            </div>
          )}

          {type === "html" ? (
            <div
              ref={htmlRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncPlaceholders}
              className="rich-editor"
              style={{
                minHeight: 260,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "14px 16px",
                background: "#ffffff",
                color: "#1a1a1a",
                fontSize: 14,
                lineHeight: 1.6,
                outline: "none",
              }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={textBody}
              onChange={(e) => {
                setTextBody(e.target.value);
                setPlaceholders(detectPlaceholdersClient(e.target.value));
              }}
              style={{ width: "100%", minHeight: 260, fontFamily: "var(--font-mono)", fontSize: 13, resize: "vertical" }}
            />
          )}

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="hint">Insert placeholder:</span>
            {COMMON_PLACEHOLDERS.map((p) => (
              <button className="btn btn-sm" key={p} onMouseDown={(e) => e.preventDefault()} onClick={() => insertPlaceholder(p)}>
                {`{{${p}}}`}
              </button>
            ))}
          </div>

          {placeholders.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="hint" style={{ marginBottom: 6 }}>
                Detected placeholders
              </div>
              <div className="tag-list">
                {placeholders.map((p) => (
                  <span className="tag" key={p}>{`{{${p}}}`}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
