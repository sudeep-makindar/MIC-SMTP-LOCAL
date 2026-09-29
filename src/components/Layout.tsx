import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { promptText } from "../lib/dialogStore";
import { IconMark, IconDashboard, IconTemplates, IconLogs, IconSettings, IconPlus } from "./icons";

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  async function handleNewCampaign() {
    const name = await promptText({
      title: "New campaign",
      message: "Give this campaign a short, recognizable name.",
      placeholder: "e.g. GLITCHCON Certificates",
      confirmLabel: "Create",
    });
    if (!name || !name.trim()) return;
    const campaign = await window.api.campaigns.create(name.trim(), "");
    navigate(`/campaigns/${campaign.id}/wizard`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">
            <IconMark size={14} />
          </div>
          <div>
            <div className="title">Campaign Manager</div>
            <div className="subtitle">Local &amp; operator-controlled</div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ margin: "0 8px 22px", justifyContent: "center" }} onClick={handleNewCampaign}>
          <IconPlus size={13} /> New Campaign
        </button>

        <div className="nav-group">
          <div className="nav-group-label">Operate</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <IconDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/templates" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <IconTemplates size={15} /> Templates
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <IconLogs size={15} /> Master Log
          </NavLink>
        </div>

        <div className="nav-group">
          <div className="nav-group-label">System</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <IconSettings size={15} /> Settings
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: "var(--text-2)" }}>Theme</span>
            <button 
              className="btn btn-sm" 
              style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-1)" }}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
          All campaign data stays on this machine.
          <br />
          Emails send via your configured SMTP provider.
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
