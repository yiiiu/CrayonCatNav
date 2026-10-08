import type { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; formError?: string; fieldErrors?: Record<string, string>; values?: Record<string, unknown> };

export type ActionFailure = Extract<ActionResult, { ok: false }>;

export function fromZodError(err: z.ZodError): ActionFailure {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors, formError: "请检查标红的字段" };
}

export class DomainError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export function fromDomainError(err: unknown): ActionFailure {
  if (err instanceof DomainError) {
    return err.field ? { ok: false, fieldErrors: { [err.field]: err.message }, formError: err.message } : { ok: false, formError: err.message };
  }
  throw err;
}
