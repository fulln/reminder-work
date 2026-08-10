import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./ActionButton.module.css";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly state?: "idle" | "pending" | "success" | "error";
  readonly pendingLabel?: string;
}

export function ActionButton({
  children,
  variant = "primary",
  state = "idle",
  pendingLabel = "Working…",
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  const pending = state === "pending";
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      className={[styles.button, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-state={state}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
