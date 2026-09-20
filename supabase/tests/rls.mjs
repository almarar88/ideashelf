import { createClient } from "@supabase/supabase-js";
const URL = "http://127.0.0.1:54321";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const results = [];
const check = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: "Passw0rd!23", email_confirm: true });
  if (error) throw new Error(email + ": " + error.message);
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: "Passw0rd!23" });
  if (e2) throw new Error("signin " + email + ": " + e2.message);
  return { id: data.user.id, client: c };
}

const A = await makeUser(`a${Date.now()}@test.local`);
const B = await makeUser(`b${Date.now()}@test.local`);
const ADM = await makeUser(`adm${Date.now()}@test.local`);
await admin.from("profiles").update({ role: "admin" }).eq("id", ADM.id);

// profile row auto-created by the trigger
const prof = await A.client.from("profiles").select("*").eq("id", A.id).maybeSingle();
check("profile auto-created on signup", !!prof.data, prof.error?.message ?? "");

// admin publishes a paid book with 2 free preview pages
const { data: book, error: bookErr } = await ADM.client.from("books").insert({
  slug: "test-" + Date.now(), title: "ديوان الاختبار", author: "مؤلف",
  page_count: 6, price_minor: 2500, currency: "AED", preview_pages: 2,
  in_subscription: true, status: "published",
}).select().single();
check("admin can publish a book", !bookErr, bookErr?.message ?? "");
if (bookErr) process.exit(1);

// a normal reader cannot publish
const { error: nopeErr } = await A.client.from("books").insert({ slug: "hack" + Date.now(), title: "مزيف", status: "published" });
check("reader CANNOT publish a book", !!nopeErr, nopeErr?.message ?? "no error returned!");

// admin uploads pages (1..6) with a tiny png each
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
for (let p = 1; p <= 6; p++) {
  const path = `${book.id}/${String(p).padStart(4, "0")}.png`;
  const up = await ADM.client.storage.from("book-pages").upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) { check(`admin uploads page ${p}`, false, up.error.message); break; }
  const ins = await ADM.client.from("book_pages").insert({ book_id: book.id, page: p, image_path: path, text: `نص الصفحة ${p}` });
  if (ins.error) { check(`admin inserts page row ${p}`, false, ins.error.message); break; }
}
check("admin uploaded 6 pages", true);

const pagesSeenBy = async (c) => {
  const { data } = await c.from("book_pages").select("page").eq("book_id", book.id).order("page");
  return (data ?? []).map((r) => r.page);
};

// catalog visible to everyone
const cat = await A.client.from("books").select("id,title,price_minor").eq("id", book.id).maybeSingle();
check("reader sees the book in the store", !!cat.data, cat.error?.message ?? "");

// preview only
check("unpaid reader sees ONLY the 2 preview pages", JSON.stringify(await pagesSeenBy(A.client)) === "[1,2]", `got ${JSON.stringify(await pagesSeenBy(A.client))}`);

// storage is blocked for a locked page
const sign = async (c, p) => {
  const path = `${book.id}/${String(p).padStart(4, "0")}.png`;
  const { data, error } = await c.storage.from("book-pages").createSignedUrl(path, 60);
  return { ok: !!data?.signedUrl, err: error?.message };
};
check("unpaid reader CAN sign a preview page", (await sign(A.client, 1)).ok);
const locked = await sign(A.client, 5);
check("unpaid reader CANNOT sign a locked page", !locked.ok, locked.err ?? "signed url was issued!");

// a reader cannot grant themselves a purchase
const selfGrant = await A.client.from("purchases").insert({ user_id: A.id, book_id: book.id, provider: "manual", provider_txn: "fake", amount_minor: 0 });
check("reader CANNOT insert their own purchase", !!selfGrant.error, selfGrant.error?.message ?? "insert succeeded!");

// server-verified purchase for A
await admin.from("purchases").insert({ user_id: A.id, book_id: book.id, provider: "manual", provider_txn: "txn-" + Date.now(), amount_minor: 2500 });
check("after purchase A sees all 6 pages", JSON.stringify(await pagesSeenBy(A.client)) === "[1,2,3,4,5,6]", `got ${JSON.stringify(await pagesSeenBy(A.client))}`);
check("after purchase A can sign a locked page", (await sign(A.client, 5)).ok);
check("B still blocked after A's purchase", JSON.stringify(await pagesSeenBy(B.client)) === "[1,2]", `got ${JSON.stringify(await pagesSeenBy(B.client))}`);

// subscription unlocks it for B
await admin.from("subscriptions").insert({ user_id: B.id, plan: "monthly", provider: "manual", provider_txn: "sub-" + Date.now(), status: "active", current_period_end: new Date(Date.now() + 30 * 864e5).toISOString() });
check("active subscriber B sees all pages", JSON.stringify(await pagesSeenBy(B.client)) === "[1,2,3,4,5,6]", `got ${JSON.stringify(await pagesSeenBy(B.client))}`);
check("subscriber B can sign a locked page", (await sign(B.client, 5)).ok);

// expire it
await admin.from("subscriptions").update({ current_period_end: new Date(Date.now() - 864e5).toISOString() }).eq("user_id", B.id);
check("expired subscriber B is blocked again", JSON.stringify(await pagesSeenBy(B.client)) === "[1,2]", `got ${JSON.stringify(await pagesSeenBy(B.client))}`);

// anonymous visitor
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
check("signed-out visitor sees the store", !!(await anon.from("books").select("id").eq("id", book.id).maybeSingle()).data);
check("signed-out visitor sees only previews", JSON.stringify(await pagesSeenBy(anon)) === "[1,2]", `got ${JSON.stringify(await pagesSeenBy(anon))}`);

// progress is private
await A.client.from("reading_progress").upsert({ user_id: A.id, book_id: book.id, last_page: 4 });
const bSeesA = await B.client.from("reading_progress").select("*").eq("user_id", A.id);
check("reader B cannot read A's progress", (bSeesA.data ?? []).length === 0);

// ---- narration follows exactly the same access rule as the page ----
const narrationPath = `${book.id}/0005-voiceX-modelY.mp3`;
await admin.storage.from("narration").upload(narrationPath, png, { contentType: "audio/mpeg", upsert: true });
await admin.from("narrations").insert({ book_id: book.id, page: 5, voice_id: "voiceX", model_id: "modelY", audio_path: narrationPath, chars: 100 });
const previewNarrationPath = `${book.id}/0001-voiceX-modelY.mp3`;
await admin.storage.from("narration").upload(previewNarrationPath, png, { contentType: "audio/mpeg", upsert: true });
await admin.from("narrations").insert({ book_id: book.id, page: 1, voice_id: "voiceX", model_id: "modelY", audio_path: previewNarrationPath, chars: 80 });

const narrationsSeenBy = async (c) => {
  const { data } = await c.from("narrations").select("page").eq("book_id", book.id).order("page");
  return (data ?? []).map((r) => r.page);
};
const signAudio = async (c, path) => {
  const { data } = await c.storage.from("narration").createSignedUrl(path, 60);
  return !!data?.signedUrl;
};

// B's subscription is expired at this point, so B is a preview-only reader again
check("preview reader sees only the preview narration", JSON.stringify(await narrationsSeenBy(B.client)) === "[1]", `got ${JSON.stringify(await narrationsSeenBy(B.client))}`);
check("preview reader CAN play the preview narration", await signAudio(B.client, previewNarrationPath));
check("preview reader CANNOT play a locked narration", !(await signAudio(B.client, narrationPath)), "signed audio url was issued!");
check("paying reader A sees both narrations", JSON.stringify(await narrationsSeenBy(A.client)) === "[1,5]", `got ${JSON.stringify(await narrationsSeenBy(A.client))}`);
check("paying reader A CAN play the locked narration", await signAudio(A.client, narrationPath));
const fakeNarration = await A.client.from("narrations").insert({ book_id: book.id, page: 6, voice_id: "v", model_id: "m", audio_path: "x" });
check("reader CANNOT insert a narration row", !!fakeNarration.error, fakeNarration.error?.message ?? "insert succeeded!");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
