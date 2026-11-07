// Plain-language messages for Supabase Auth errors (web + mobile).
export type AuthErr = { code?: string; message: string; status?: number };

/** Map Supabase Auth errors to plain-language messages. */
export function authMessage(error: AuthErr): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "We've just sent an email to this address. Wait a minute before asking for another.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute, then try again.";
    case "weak_password":
      return "This password is too easy to guess. Choose a longer one with letters and numbers.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "signup_disabled":
      return "New registrations are currently closed.";
    case "user_banned":
      return "This account has been disabled. Contact the HR team for help.";
    case "email_address_invalid":
      return "This email address can't be used. Check it and try again.";
  }
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  return "We couldn't complete that request. Try again in a moment.";
}

