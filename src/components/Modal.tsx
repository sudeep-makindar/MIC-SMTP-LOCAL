import type { ReactNode } from "react";
import { IconClose } from "./icons";

export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal-box ${wide ? "wide" : ""}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <IconClose size={13} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
