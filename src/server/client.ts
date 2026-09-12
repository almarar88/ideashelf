import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * عميل Supabase. يبقى `null` إن لم تُضبط المتغيّرات، فيعمل التطبيق كاملاً
 * في وضع محلي بلا خادم — وهذا وضع مقصود لا حالة عطل.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // التطبيق داخل WebView لا يستقبل روابط عودة، فلا نحاول قراءة الجلسة من الرابط
          detectSessionInUrl: false,
        },
      })
    : null;

export const cloudReady = supabase !== null;
