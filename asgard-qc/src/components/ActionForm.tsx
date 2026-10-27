"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/action";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** A form bound to a server action, with pending state and inline result. */
export function ActionForm({
  action,
  children,
  submit = "Save",
  submitClass = "btn-primary",
  resetOnSuccess = false,
  confirm,
  className,
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submit?: ReactNode;
  submitClass?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    if (state.redirect) router.push(state.redirect);
    else if (resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess, router]);

  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={clsx(inline ? "flex flex-wrap items-end gap-2" : "space-y-4", className)}
    >
      {children}
      <div className={clsx("flex flex-wrap items-center gap-3", !inline && "pt-1")}>
        <button type="submit" className={submitClass} disabled={pending}>
          {pending ? "Working…" : submit}
        </button>
        {state && (
          <span role="status" className={clsx("text-sm", state.ok ? "text-ok-400" : "text-bad-400")}>
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
    </form>
  );
}
