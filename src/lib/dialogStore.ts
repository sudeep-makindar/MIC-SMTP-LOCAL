// A tiny pub-sub store backing a single global confirm/prompt dialog, so the
// app never falls back to window.confirm/window.prompt (which render as
// jarring native browser chrome inside an otherwise custom-designed app).
// Mounted once via <DialogHost /> at the app root.

export type DialogRequest =
  | {
      kind: "confirm";
      id: number;
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      danger: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      kind: "prompt";
      id: number;
      title: string;
      message?: string;
      placeholder?: string;
      defaultValue: string;
      confirmLabel: string;
      cancelLabel: string;
      resolve: (value: string | null) => void;
    };

let current: DialogRequest | null = null;
let nextId = 1;
type Listener = (req: DialogRequest | null) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(current));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrent(): DialogRequest | null {
  return current;
}

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmAction(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      kind: "confirm",
      id: nextId++,
      title: opts.title ?? "Are you sure?",
      message,
      confirmLabel: opts.confirmLabel ?? "Confirm",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      danger: opts.danger ?? false,
      resolve,
    };
    notify();
  });
}

export interface PromptOptions {
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function promptText(opts: PromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    current = {
      kind: "prompt",
      id: nextId++,
      title: opts.title ?? "Enter a value",
      message: opts.message,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue ?? "",
      confirmLabel: opts.confirmLabel ?? "Continue",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      resolve,
    };
    notify();
  });
}

export function resolveCurrent(value: boolean | string | null): void {
  const req = current;
  current = null;
  notify();
  if (!req) return;
  if (req.kind === "confirm") req.resolve(value === true);
  else req.resolve(typeof value === "string" ? value : null);
}
