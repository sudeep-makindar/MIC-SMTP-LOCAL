import { useMemo } from "react";
import type { PreviewDevice, PreviewTheme, RenderedEmail } from "@shared/types";
import { IconClip } from "./icons";

export default function EmailPreviewFrame({
  rendered,
  device,
  theme,
}: {
  rendered: RenderedEmail;
  device: PreviewDevice;
  theme: PreviewTheme;
}) {
  const dark = theme === "dark";

  const srcDoc = useMemo(() => {
    if (!rendered.html) return null;
    const bg = dark ? "#1c1e22" : "#ffffff";
    const fg = dark ? "#eaeaea" : "#1a1a1a";
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:18px;background:${bg};color:${fg};font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;}
      img{max-width:100%;}
      a{color:${dark ? "#7cb0ff" : "#2f6fed"};}
    </style></head><body>${rendered.html}</body></html>`;
  }, [rendered.html, dark]);

  return (
    <div className="preview-frame-wrap">
      <div className={`device-frame ${device} ${dark ? "dark" : ""}`}>
        <div className="email-meta">
          <div className="row">
            <span className="k">From</span>
            <span>{rendered.from || "(sender not configured)"}</span>
          </div>
          <div className="row">
            <span className="k">To</span>
            <span>{rendered.to}</span>
          </div>
          {rendered.cc.length > 0 && (
            <div className="row">
              <span className="k">Cc</span>
              <span>{rendered.cc.join(", ")}</span>
            </div>
          )}
          {rendered.bcc.length > 0 && (
            <div className="row">
              <span className="k">Bcc</span>
              <span>{rendered.bcc.join(", ")}</span>
            </div>
          )}
          {rendered.replyTo && (
            <div className="row">
              <span className="k">Reply-To</span>
              <span>{rendered.replyTo}</span>
            </div>
          )}
          <div className="row">
            <span className="k">Subject</span>
            <span style={{ fontWeight: 700 }}>{rendered.subject}</span>
          </div>
          {rendered.attachments.length > 0 && (
            <div className="row">
              <span className="k">Files</span>
              <span>
                {rendered.attachments.map((a) => (
                  <span key={a.name} style={{ marginRight: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <IconClip size={12} /> {a.name} {!a.exists && <span style={{ color: "#d94b4b" }}>(missing)</span>}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="email-body">
          {rendered.html ? (
            <iframe
              title="email-preview"
              srcDoc={srcDoc ?? ""}
              sandbox=""
              style={{ width: "100%", height: 440, border: "none", background: dark ? "#1c1e22" : "#fff" }}
            />
          ) : (
            <div style={{ whiteSpace: "pre-wrap" }}>{rendered.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
