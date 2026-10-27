export function supportAddress() {
  return process.env.SUPPORT_EMAIL?.trim() ?? "";
}

function withSupportAddress(template: string) {
  return template.replaceAll("{SUPPORT_EMAIL}", supportAddress());
}

/** Shoppers see this for a new or existing email. */
export const SIGNUP_CHECK_EMAIL = "Check your email. We sent you a message with the next step.";

/** Subject of the note sent when that email already has an account. */
export const SIGNUP_TAKEN_SUBJECT = "Someone tried to sign up with your email";

const SIGNUP_TAKEN_TEMPLATE =
  "Someone just tried to create an XV-AIsle account with this email address. You already have an account, so nothing changed. If it was you, sign in or reset your password. If it wasn't you, you can ignore this email. Questions? Email us at {SUPPORT_EMAIL}.";

export function signupTakenText() {
  return withSupportAddress(SIGNUP_TAKEN_TEMPLATE);
}

/** Refusal for a common password. */
export const COMMON_PASSWORD = "That password is easy to guess. Please choose a different one." as const;

/** Subject of the note sent after a password reset. */
export const PASSWORD_CHANGED_SUBJECT = "Your XV-AIsle password was changed" as const;

const PASSWORD_CHANGED_TEMPLATE =
  "Your XV-AIsle password was just changed. If you did this, you're all set. If you didn't, reset your password and email us at {SUPPORT_EMAIL} so we can help.";

const RECEIPT_SUPPORT_TEMPLATE = "Questions? Email us at {SUPPORT_EMAIL}.";

export function receiptSupportLine() {
  return withSupportAddress(RECEIPT_SUPPORT_TEMPLATE);
}

export function passwordChangedText() {
  return withSupportAddress(PASSWORD_CHANGED_TEMPLATE);
}

/** Response when sign-in is missing a string email or password. */
export const SIGNIN_400 = "Enter your email and password." as const;

/** Production has to know where account emails send people for help. */
export function assertProductionSupportEmail() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (supportAddress()) return;
  const message = "SUPPORT_EMAIL is unset. Production will not start until SUPPORT_EMAIL is set.";
  console.error(message);
  throw new Error(message);
}
