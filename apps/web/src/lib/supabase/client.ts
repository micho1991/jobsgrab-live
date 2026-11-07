"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Supabase client for Client Components (uploads, realtime). */
export const createClient = () => createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
