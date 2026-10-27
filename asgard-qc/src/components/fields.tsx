import clsx from "clsx";
import type { ReactNode } from "react";

type Opt = string | { value: string; label: string };

const toDateInput = (v: unknown, withTime: boolean) => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return undefined;
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return withTime ? local.slice(0, 16) : local.slice(0, 10);
};

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "datetime" | "number" | "select" | "checkbox" | "email" | "password";
  options?: Opt[];
  required?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  defaultValue?: unknown;
  span?: 1 | 2 | 3;
  allowEmpty?: boolean | string;
  step?: string;
}

export function Field({ f }: { f: FieldDef }) {
  const id = `f-${f.name}`;
  const common = { id, name: f.name, required: f.required, placeholder: f.placeholder, "aria-describedby": f.hint ? `${id}-hint` : undefined };
  let control: ReactNode;
  switch (f.type) {
    case "textarea":
      control = <textarea {...common} rows={3} className="input" defaultValue={(f.defaultValue as string) ?? ""} />;
      break;
    case "select":
      control = (
        <select {...common} className="input" defaultValue={(f.defaultValue as string) ?? ""}>
          {f.allowEmpty !== false && <option value="">{typeof f.allowEmpty === "string" ? f.allowEmpty : f.required ? "Select…" : "—"}</option>}
          {(f.options ?? []).map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      );
      break;
    case "checkbox":
      return (
        <label className={clsx("flex items-center gap-2 text-sm text-ink-100", f.span === 2 && "sm:col-span-2", f.span === 3 && "sm:col-span-3")}>
          <input type="checkbox" name={f.name} defaultChecked={!!f.defaultValue} className="h-4 w-4 rounded border-ink-500 bg-ink-900 accent-[#c39a45]" />
          {f.label}
          {f.hint && <span className="text-xs text-ink-300">{f.hint}</span>}
        </label>
      );
    case "date":
    case "datetime":
      control = <input {...common} type={f.type === "date" ? "date" : "datetime-local"} className="input" defaultValue={toDateInput(f.defaultValue, f.type === "datetime")} />;
      break;
    default:
      control = <input {...common} type={f.type ?? "text"} step={f.step} className="input" defaultValue={f.defaultValue == null ? undefined : String(f.defaultValue)} autoComplete={f.type === "password" ? "new-password" : undefined} />;
  }
  return (
    <div className={clsx(f.span === 2 && "sm:col-span-2", f.span === 3 && "sm:col-span-3")}>
      <label htmlFor={id} className="label">
        {f.label}
        {f.required && <span className="text-gold-400"> *</span>}
      </label>
      {control}
      {f.hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-300">
          {f.hint}
        </p>
      )}
    </div>
  );
}

export function Fields({ fields, cols = 2 }: { fields: FieldDef[]; cols?: 1 | 2 | 3 }) {
  return (
    <div className={clsx("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {fields.map((f) => (
        <Field key={f.name} f={f} />
      ))}
    </div>
  );
}

export function Hidden({ name, value }: { name: string; value: string | null | undefined }) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

/** GET filter bar: works without JavaScript and keeps filters in the URL. */
export function FilterBar({ children, action, reset }: { children: ReactNode; action?: string; reset?: string }) {
  return (
    <form method="get" action={action} className="card card-pad mb-4 flex flex-wrap items-end gap-3">
      {children}
      <div className="flex gap-2">
        <button className="btn-secondary" type="submit">
          Apply
        </button>
        {reset && (
          <a className="btn-ghost" href={reset}>
            Clear
          </a>
        )}
      </div>
    </form>
  );
}

export function FilterSelect({ name, label, options, value, empty = "All" }: { name: string; label: string; options: Opt[]; value?: string | null; empty?: string }) {
  return (
    <div className="min-w-[150px] max-w-[260px]">
      <label className="label" htmlFor={`flt-${name}`}>
        {label}
      </label>
      <select id={`flt-${name}`} name={name} defaultValue={value ?? ""} className="input">
        <option value="">{empty}</option>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function FilterInput({ name, label, value, type = "text", placeholder }: { name: string; label: string; value?: string | null; type?: string; placeholder?: string }) {
  return (
    <div className="min-w-[140px]">
      <label className="label" htmlFor={`flt-${name}`}>
        {label}
      </label>
      <input id={`flt-${name}`} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="input" />
    </div>
  );
}
