"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import { IconAlertCircle, IconCheckCircle, IconChevronDown, IconEye, IconEyeOff, IconInfo, IconX } from "@/components/icons";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface shadow-xs",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Spinner                                                             */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-line bg-surface text-foreground shadow-xs hover:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
  danger:
    "border border-red-300 text-red-600 shadow-xs hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40",
} as const;

const BUTTON_SIZES = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

/**
 * The one class list for every button-shaped element — `<Button>` uses it,
 * and links call it directly so a CTA never drifts from the real button:
 *   `<Link href="…" className={buttonClass("primary")}>…</Link>`
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 touch-target",
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const BADGE_TONES = {
  neutral: "border-line bg-surface-muted text-muted",
  brand:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-800/20 dark:text-brand-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
} as const;

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONES;
  /** Show a small status dot before the label. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge — one mapping for appointment/booking states            */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<string, { tone: keyof typeof BADGE_TONES; label: string }> = {
  confirmed: { tone: "success", label: "Confirmed" },
  cancelled: { tone: "danger", label: "Cancelled" },
  pending: { tone: "warning", label: "Pending" },
  sent: { tone: "brand", label: "Sent" },
};

/** Humanised status pill; unknown values are title-cased instead of hidden. */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? {
    tone: "neutral" as const,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground transition placeholder:text-muted/70 focus:border-brand-400 disabled:opacity-60";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
  required,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Marks the label with a red `*` — only for fields the user must fill in. */
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
        {label}
        {required && (
          <span className="ml-0.5 font-medium text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>
        )}
        {hint && <span className="ml-1 font-normal text-muted/80">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  className,
  showPasswordToggle = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { showPasswordToggle?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = rest.type === "password";

  if (!showPasswordToggle || !isPassword) {
    return <input {...rest} className={cn(inputClass, className)} />;
  }

  return (
    <div className="relative">
      <input
        {...rest}
        type={showPassword ? "text" : "password"}
        className={cn(inputClass, className, "pr-10")}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:text-foreground touch-target"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function SelectInput({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...rest} className={cn(inputClass, "appearance-none pr-9", className)}>
        {children}
      </select>
      <IconChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </span>
  );
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(inputClass, "min-h-24 resize-y", className)} />;
}

/** Labelled checkbox with a filled brand box (native input, custom paint). */
export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm transition hover:bg-surface-muted",
        className,
      )}
    >
      <input
        type="checkbox"
        {...rest}
        className="h-4 w-4 shrink-0 rounded border-line accent-brand-600"
      />
      <span className="min-w-0">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

const ALERT_TONES = {
  info: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-800/20 dark:text-brand-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
} as const;

const ALERT_ICONS = {
  info: IconInfo,
  success: IconCheckCircle,
  warning: IconAlertCircle,
  danger: IconAlertCircle,
} as const;

export function Alert({
  tone = "info",
  children,
  className,
  icon = true,
}: {
  tone?: keyof typeof ALERT_TONES;
  children: ReactNode;
  className?: string;
  /** Hide the leading icon (e.g. for long, multi-line content). */
  icon?: boolean;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
        ALERT_TONES[tone],
        className,
      )}
    >
      {icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-4 py-10 text-center">
      {icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-muted">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted" role="status">
      <Spinner />
      {label}
    </div>
  );
}

/** Shimmer placeholder shown while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-lg bg-surface-muted", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Page furniture                                                      */
/* ------------------------------------------------------------------ */

/** Standard page heading: one title, one human sentence, optional actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Summary metric tile for dashboard-style overview rows. */
export function StatCard({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "danger" | "brand";
  className?: string;
}) {
  const tones = {
    neutral: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    brand: "text-brand-600 dark:text-brand-300",
  } as const;

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface px-4 py-3.5 shadow-xs",
        className,
      )}
    >
      <p className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tones[tone])}>{value}</p>
    </div>
  );
}

/** Deterministic initials avatar (no images needed). */
const AVATAR_TONES = [
  "bg-brand-100 text-brand-700 dark:bg-brand-800/50 dark:text-brand-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
] as const;

export function Avatar({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-xs font-semibold",
        imageUrl ? "bg-surface-muted" : AVATAR_TONES[hash % AVATAR_TONES.length],
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chips                                                        */
/* ------------------------------------------------------------------ */

export type ChipOption = { value: string; label: string; count?: number };

/** Pill group for list filters (segmented by state, not navigation). */
export function FilterChips({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition touch-target",
              selected
                ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-800/30 dark:text-brand-200"
                : "border-line bg-surface text-muted hover:border-brand-300 hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1.5 text-2xs font-normal opacity-70">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slots — shared appointment time chips                              */
/* ------------------------------------------------------------------ */

export type SlotState = "open" | "selected" | "unavailable";

const SLOT_STATES = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:border-emerald-700",
  selected:
    "border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-400 dark:border-brand-600 dark:bg-brand-800/30 dark:text-brand-200 dark:ring-brand-600",
  unavailable:
    "cursor-not-allowed border-line bg-surface-muted text-muted opacity-70",
} as const;

/**
 * One chip for every slot surface (availability grid, reschedule picker,
 * in-chat booking prompt). Renders a `<button>` when `onClick` is given and a
 * static tile otherwise.
 */
export function SlotChip({
  time,
  note,
  state = "open",
  disabled,
  onClick,
  title,
  className,
}: {
  /** Already-formatted time, e.g. "10:30 AM". */
  time: string;
  /** Small second line: "open", "current", a conflict reason… */
  note?: string;
  state?: SlotState;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const classes = cn(
    "block w-full rounded-lg border px-3 py-2 text-left text-xs transition",
    SLOT_STATES[state],
    disabled && state !== "unavailable" && "cursor-not-allowed opacity-60",
    className,
  );
  const content = (
    <>
      <span className="font-medium">{time}</span>
      {note && <span className="mt-0.5 block text-2xs">{note}</span>}
    </>
  );

  if (!onClick) {
    return (
      <div className={classes} title={title}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      title={title}
      className={cn(classes, "touch-target")}
    >
      {content}
    </button>
  );
}

/** Responsive grid that all slot lists share. */
export function SlotGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {children}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

/** Scrollable, rounded, shadowed table container. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("table-responsive rounded-xl border border-line bg-surface shadow-xs", className)}>
      {children}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn("w-full text-sm [&_tr:last-child>td]:border-b-0", className)}>
      {children}
    </table>
  );
}

export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line bg-surface-muted/60 px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("transition hover:bg-surface-muted/50", className)}>{children}</tr>;
}

export function TD({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Portal dialog: backdrop click, Escape, body scroll lock, focus capture and
 * focus restoration. Header/footer live inside the panel so callers only pass
 * content.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  footer,
  children,
  size = "md",
  labelledBy,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const generatedId = useId();
  const headingId = labelledBy ?? generatedId;

  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Start inside the dialog, then keep Tab cycling within it.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((node) => node.offsetParent !== null);
      if (nodes.length === 0) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstNode || active === panelRef.current)) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && active === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto p-4 sm:p-6">
      <div className="overlay-in fixed inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-end justify-center sm:items-center">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          tabIndex={-1}
          className={cn(
            "panel-in relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-xl outline-none",
            width,
          )}
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0">
              <h2 id={headingId} className="text-sm font-semibold tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-m-1.5 rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground touch-target"
            >
              <IconX className="h-4 w-4" />
            </button>
          </header>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted/95 px-5 py-3 backdrop-blur">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmDialog — replaces window.confirm                             */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          loading={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
