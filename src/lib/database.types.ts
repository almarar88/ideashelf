/** Hand-written to match supabase/migrations. Regenerate with `supabase gen types typescript`. */
export type UserRole = "reader" | "admin";
export type BookStatus = "draft" | "published" | "hidden";
export type PayProvider = "google_play" | "stripe" | "manual";
export type SubStatus = "active" | "canceled" | "expired" | "grace";

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface BookRow {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  language: string;
  cover_url: string | null;
  page_count: number;
  price_minor: number;
  currency: string;
  preview_pages: number;
  in_subscription: boolean;
  status: BookStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface BookPageRow {
  book_id: string;
  page: number;
  image_path: string;
  width: number | null;
  height: number | null;
  text: string;
}

export interface PurchaseRow {
  id: string;
  user_id: string;
  book_id: string;
  provider: PayProvider;
  provider_txn: string;
  amount_minor: number;
  currency: string;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  provider: PayProvider;
  provider_txn: string;
  status: SubStatus;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgressRow {
  user_id: string;
  book_id: string;
  last_page: number;
  reading_seconds: number;
  favorite: boolean;
  updated_at: string;
}

export interface AiResultRow {
  id: string;
  book_id: string;
  kind: string;
  scope_key: string;
  scope_label: string;
  content: string;
  model: string;
  created_by: string | null;
  created_at: string;
}
