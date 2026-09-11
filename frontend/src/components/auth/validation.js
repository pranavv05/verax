/**
 * Turns a Zod error into a `{ field: message }` map so each message can be
 * rendered under the input it belongs to.
 *
 * This changes presentation only — the schemas themselves are untouched, and
 * no validation rule is added, removed or loosened. Previously both auth pages
 * showed `issues[0].message` in a single banner at the top of the form, which
 * meant a user with two bad fields fixed one, resubmitted, and was told about
 * the next one. First message per field wins, matching the old behaviour for
 * any single field.
 */
export const collectFieldErrors = (zodError) => {
  const errors = {};
  for (const issue of zodError.issues) {
    const field = issue.path[0];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
};
