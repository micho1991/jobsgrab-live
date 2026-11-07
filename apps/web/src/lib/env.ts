// Public configuration. NEXT_PUBLIC_* values are inlined at build time.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Used to build email/OAuth redirect links. Never derived from the Host header
  // to rule out host-header poisoning of password-reset links.
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Acme",
  privacyContact: process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? "privacy@example.com",
};
