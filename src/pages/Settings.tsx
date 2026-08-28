import { useEffect, useState } from "react";
import type { SmtpProfile } from "@shared/types";
import { confirmAction } from "../lib/dialogStore";
import { IconTrash } from "../components/icons";

export default function Settings() {
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [dataRoot, setDataRoot] = useState("");
  const [backups, setBackups] = useState<{ name: string; path: string; manifest: { createdAt: string } | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAll() {
    setProfiles(await window.api.smtp.list());
    setDataRoot(await window.api.settings.dataRoot());
    setBackups(await window.api.backup.list());
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function deleteProfile(id: string) {
    const ok = await confirmAction("Campaigns referencing it will need a new profile selected.", {
      title: "Delete this SMTP profile?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await window.api.smtp.delete(id);
    loadAll();
  }

  async function createBackup() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.api.backup.create();
      setMessage(`Backup created at ${result.path}`);
      loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    const folder = await window.api.backup.pickFolder();
    if (!folder) return;
    const ok = await confirmAction("This overwrites current campaigns, templates, and logs with the backup's contents.", {
      title: "Restore from backup?",
      confirmLabel: "Restore",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await window.api.backup.restore(folder);
      setMessage("Restore complete. Please restart the application for changes to fully take effect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">SMTP profiles, local data location, and backups</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>SMTP Profiles</h3>
        </div>
        {profiles.length === 0 ? (
          <div className="empty-state">No SMTP profiles configured yet. Add one from the campaign wizard's SMTP step.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Host</th>
                <th>Security</th>
                <th>Username</th>
                <th>From Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">
                    {p.host}:{p.port}
                  </td>
                  <td>{p.security.toUpperCase()}</td>
                  <td>{p.username}</td>
                  <td className={p.fromEmail ? "" : "text-danger"}>{p.fromEmail || "(not set)"}</td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => deleteProfile(p.id)}>
                      <IconTrash size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="hint" style={{ padding: "0 20px 16px" }}>
          Passwords are never saved to disk — they're held in memory only for the current session and must be re-entered after restart.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Local Data</h3>
        </div>
        <div className="card-pad">
          <div className="hint" style={{ marginBottom: 8 }}>
            All campaign data, templates, and logs are stored locally at:
          </div>
          <div className="mono" style={{ marginBottom: 12 }}>
            {dataRoot}
          </div>
          <button className="btn btn-sm" onClick={() => window.api.settings.openDataFolder()}>
            Open Data Folder
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Backup &amp; Restore</h3>
        </div>
        <div className="card-pad">
          {message && <div className="banner banner-info">{message}</div>}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={createBackup} disabled={busy}>
              Create Backup
            </button>
            <button className="btn" onClick={restoreBackup} disabled={busy}>
              Restore From Backup…
            </button>
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Backups include campaigns, templates, and the master log. SMTP passwords are never included since they are never stored on disk.
          </div>
          {backups.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Backup</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.path}>
                    <td className="mono">{b.name}</td>
                    <td className="text-muted">{b.manifest ? new Date(b.manifest.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
