// Turn Postgres/PostgREST errors from our RPCs into friendly messages.
// Our functions raise human-readable messages; constraint violations get mapped here.
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  const msg = err.message ?? "";
  if (err.code === "23505" && !/already/i.test(msg)) return "This record already exists.";
  if (err.code === "23514") return "Some of the information provided is invalid. Please check the form.";
  if (err.code === "42501" && /row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (/JWT|not authenticated/i.test(msg)) return "Your session has expired. Please sign in again.";
  return msg || "Something went wrong. Please try again.";
}
