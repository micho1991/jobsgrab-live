import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { ALLOWED_MIME_TYPES, STORAGE_BUCKET, buildStoragePath, validateFile } from "@hr/shared";
import { supabase } from "./supabase";

export interface UploadedFile { path: string; name: string; size: number; mimeType: string }

/** Let the user pick a PDF/DOC/DOCX and upload it to their private storage folder. */
export async function pickAndUpload(userId: string): Promise<{ file?: UploadedFile; error?: string; cancelled?: boolean }> {
  const res = await DocumentPicker.getDocumentAsync({ type: Object.keys(ALLOWED_MIME_TYPES), copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return { cancelled: true };
  const a = res.assets[0];
  const check = validateFile({ name: a.name, size: a.size ?? 0, type: a.mimeType });
  if (!check.ok) return { error: check.error };

  const path = buildStoragePath(userId, check.mimeType);
  // Web gives us a File; native gives a file:// URI we read into memory.
  const body = Platform.OS === "web" && a.file
    ? new File([a.file], a.name, { type: check.mimeType })
    : await (await fetch(a.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, body, { contentType: check.mimeType, upsert: false, cacheControl: "0" });
  if (error) return { error: "The upload didn't complete. Check your connection and try again." };
  return { file: { path, name: a.name, size: a.size ?? 0, mimeType: check.mimeType } };
}

export async function discardUpload(path: string) {
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

/**
 * Open a document via a 60-second signed link (the OS shows or saves it).
 * `before` runs first (e.g. audit logging) and can veto. On web the tab is
 * opened synchronously within the tap, otherwise browsers block it as a popup.
 */
export async function openDocument(storagePath: string, fileName: string, before?: () => Promise<boolean>): Promise<{ error?: string }> {
  const tab = Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
  const fail = (error: string) => { tab?.close(); return { error }; };
  if (before && !(await before())) return fail("You don't have permission to open this document.");
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60, { download: fileName });
  if (error || !data) return fail("The document couldn't be opened. Try again.");
  if (tab) tab.location.href = data.signedUrl;
  else await WebBrowser.openBrowserAsync(data.signedUrl);
  return {};
}
