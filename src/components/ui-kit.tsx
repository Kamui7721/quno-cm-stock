import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string | undefined; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

type BadgeTone = "success" | "danger" | "warning" | "neutral";

export function Badge({
  tone = "neutral",
  color,
  children,
  className,
  onClick,
}: {
  tone?: BadgeTone | undefined;
  color?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  const tones: Record<BadgeTone, string> = {
    success: "bg-success/20 text-success",
    danger: "bg-primary/20 text-primary",
    warning: "bg-warning/20 text-warning",
    neutral: "bg-muted text-muted-foreground",
  };
  const style = color
    ? { backgroundColor: `${color}33`, color }
    : undefined;
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        !color && tones[tone],
        onClick && "cursor-pointer transition-opacity hover:opacity-80",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | undefined;
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-[#be123c]",
    danger: "bg-primary/15 text-primary hover:bg-primary/25",
    outline: "border border-border bg-transparent text-foreground hover:bg-muted",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:min-h-0",
        variants[variant],
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const controlCls =
  "w-full min-h-12 rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary sm:min-h-0 sm:text-sm";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlCls, className)} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlCls, className)} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlCls, className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean | undefined;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-2xl scroll-slim sm:max-h-[85vh]",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  action?: ReactNode | undefined;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto border-l border-border bg-card scroll-slim">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            {action}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="space-y-6 p-5">{children}</div>
      </aside>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || "–"}</span>
    </div>
  );
}

const TableHeadContext = createContext<string[]>([]);

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="resp-table overflow-x-auto">
      <TableHeadContext.Provider value={head}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {head.map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      </TableHeadContext.Provider>
    </div>
  );
}

export function Tr({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
}) {
  const head = useContext(TableHeadContext);
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/50 transition-colors odd:bg-surface-2/40 hover:bg-muted/60",
        onClick && "cursor-pointer",
      )}
    >
      {Children.map(children, (child, i) =>
        isValidElement<{ label?: string | undefined }>(child)
          ? cloneElement(child, { label: head[i] ?? "" })
          : child,
      )}
    </tr>
  );
}

export function Td({
  children,
  className,
  label,
}: {
  children?: ReactNode | undefined;
  className?: string | undefined;
  label?: string | undefined;
}) {
  return (
    <td data-label={label} className={cn("px-5 py-3 text-foreground", className)}>
      {children}
    </td>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</div>;
}