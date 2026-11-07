export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  companyName: process.env.EXPO_PUBLIC_COMPANY_NAME ?? "Acme",
};
