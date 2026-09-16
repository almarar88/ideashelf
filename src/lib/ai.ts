import Anthropic from "@anthropic-ai/sdk";
import { loadSettings, type Effort, type ModelId } from "./settings";
import { getBookText, type Book } from "./db";

/* ----------------------------------------------------------------------------
 * Client
 * The key lives only in this browser (localStorage) and is sent straight to
 * api.anthropic.com — there is no server in between.
 * ------------------------------------------------------------------------- */
export function getClient(): Anthropic {
  const { apiKey } = loadSettings();
  if (!apiKey) throw new NoApiKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

export class NoApiKeyError extends Error {
  constructor() {
    super("لم يتم إدخال مفتاح API. افتح الإعدادات وأضف مفتاح Anthropic.");
    this.name = "NoApiKeyError";
  }
}

export function describeError(err: unknown): string {
  if (err instanceof NoApiKeyError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "مفتاح API غير صالح. تحقق منه في الإعدادات.";
  if (err instanceof Anthropic.RateLimitError) return "تم تجاوز حد الطلبات. انتظر قليلاً ثم أعد المحاولة.";
  if (err instanceof Anthropic.BadRequestError) return `طلب غير صالح: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من الإنترنت.";
  if (err instanceof Anthropic.APIError) return `خطأ من الخدمة (${err.status}): ${err.message}`;
  if (err instanceof Error) {
    if (err.name === "AbortError") return "تم الإيقاف.";
    return err.message;
  }
  return "حدث خطأ غير متوقع.";
}

/* ----------------------------------------------------------------------------
 * Context building
 * ------------------------------------------------------------------------- */
export type Scope = { kind: "page"; page: number } | { kind: "range"; from: number; to: number } | { kind: "book" };

export function scopeLabel(scope: Scope): string {
  if (scope.kind === "page") return `صفحة ${scope.page}`;
  if (scope.kind === "range") return `الصفحات ${scope.from}–${scope.to}`;
  return "الكتاب كاملاً";
}

// ~1M-token context on current models; Arabic averages ~2.5 chars/token, so
// 1.6M chars is a safe ceiling for a single request. Longer books go through
// a map-reduce pass (see summarizeLong below).
const MAX_SINGLE_CHARS = 1_600_000;
const CHUNK_CHARS = 350_000;

export async function buildContext(book: Book, scope: Scope): Promise<string> {
  const rows =
    scope.kind === "page"
      ? await getBookText(book.id, scope.page, scope.page)
      : scope.kind === "range"
        ? await getBookText(book.id, scope.from, scope.to)
        : await getBookText(book.id);
  return rows.map((r) => `<page number="${r.page}">\n${r.text}\n</page>`).join("\n");
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const block of text.split(/(?=<page number=)/)) {
    if (cur.length + block.length > CHUNK_CHARS && cur) {
      chunks.push(cur);
      cur = "";
    }
    cur += block;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/* ----------------------------------------------------------------------------
 * Prompts
 * ------------------------------------------------------------------------- */
const SYSTEM = `أنت مساعد قراءة وتحليل داخل تطبيق "مكتبة الكود الرقمية". يعطيك المستخدم نص كتاب (أو جزءًا منه) مستخرجًا من ملف PDF، مع أرقام الصفحات في وسوم <page>.
قواعدك:
- اعتمد على النص المعطى فقط، ولا تخترع معلومات غير موجودة فيه. إذا كان النص ناقصًا أو غير واضح (مثل صفحات ممسوحة ضوئيًا بلا نص) قل ذلك صراحة.
- عند الاستشهاد بفكرة اذكر رقم الصفحة بين قوسين مثل (ص 12).
- اكتب بالعربية الفصحى الواضحة ما لم يطلب المستخدم لغة أخرى، وحافظ على المصطلحات التقنية بلغتها الأصلية بين قوسين عند الحاجة.
- استخدم تنسيق Markdown بسيطًا: عناوين قصيرة، قوائم نقطية، وجداول عند الفائدة. لا تبدأ بمقدمات مجاملة.`;

export type TaskKind = "summary" | "analysis" | "quiz" | "explain";

export function taskPrompt(kind: TaskKind, extra?: string): string {
  switch (kind) {
    case "summary":
      return `لخّص هذا النص. ابدأ بفقرة تمهيدية من ثلاثة أسطر تشرح موضوعه وجمهوره، ثم قسم "الأفكار الرئيسية" (5–10 نقاط، كل نقطة بسطر أو سطرين مع رقم الصفحة)، ثم قسم "أهم ما يُستفاد" بثلاث نقاط عملية. إذا كان النص كتابًا كاملاً أضف قسمًا يعرض بنية الفصول باختصار.${extra ? `\n\nملاحظات المستخدم: ${extra}` : ""}`;
    case "analysis":
      return `حلّل هذا النص تحليلاً نقديًا منظمًا بالأقسام التالية:
1. **الأطروحة المركزية**: ما الذي يحاول النص إثباته؟
2. **البنية والحجج**: كيف يبني الكاتب حجته؟ اذكر الحجج الأساسية بترتيبها مع الصفحات.
3. **المفاهيم والمصطلحات المفتاحية**: جدول من عمودين (المصطلح — الشرح باختصار).
4. **نقاط القوة** و**نقاط الضعف أو الثغرات** في الطرح.
5. **الجمهور المناسب** ومتى يكون هذا الكتاب مفيدًا.
6. **أسئلة للتفكير** (ثلاثة أسئلة عميقة يثيرها النص).${extra ? `\n\nملاحظات المستخدم: ${extra}` : ""}`;
    case "quiz":
      return `أنشئ اختبارًا من 8 أسئلة لقياس فهم هذا النص: 5 أسئلة اختيار من متعدد (أربعة خيارات لكل سؤال) و3 أسئلة مفتوحة قصيرة. رتّبها من السهل إلى الصعب. ضع الإجابات النموذجية في قسم منفصل في النهاية بعنوان "الإجابات" مع الإشارة إلى الصفحة التي تدعم كل إجابة.${extra ? `\n\nملاحظات المستخدم: ${extra}` : ""}`;
    case "explain":
      return `اشرح هذا النص شرحًا مبسطًا لقارئ غير متخصص، كأنك معلم صبور. فكّك أي فكرة معقدة إلى خطوات، واستخدم مثالاً واحدًا من الحياة الواقعية عند الحاجة، ثم اختم بخلاصة من سطرين.${extra ? `\n\nملاحظات المستخدم: ${extra}` : ""}`;
  }
}

/* ----------------------------------------------------------------------------
 * Streaming helpers
 * ------------------------------------------------------------------------- */
export interface StreamOptions {
  signal?: AbortSignal;
  onDelta: (text: string, full: string) => void;
  model?: ModelId;
  effort?: Effort;
}

async function streamOnce(
  client: Anthropic,
  system: string,
  messages: Anthropic.MessageParam[],
  opts: StreamOptions,
): Promise<string> {
  const s = loadSettings();
  const model = opts.model ?? s.model;
  const isHaiku = model === "claude-haiku-4-5";
  const stream = client.messages.stream(
    {
      model,
      max_tokens: isHaiku ? 16000 : 32000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      // Haiku 4.5 does not accept output_config.effort; the 5-series models run adaptive thinking by default.
      ...(isHaiku ? {} : { output_config: { effort: opts.effort ?? s.effort } }),
    },
    { signal: opts.signal },
  );
  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full += event.delta.text;
      opts.onDelta(event.delta.text, full);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    throw new Error("رفض النموذج إكمال هذا الطلب لأسباب تتعلق بسياسة الاستخدام.");
  }
  if (final.stop_reason === "max_tokens") {
    full += "\n\n_(توقّف الإخراج عند الحد الأقصى للطول — جرّب نطاقًا أصغر من الصفحات.)_";
    opts.onDelta("", full);
  }
  return full;
}

/** Run a task (summary / analysis / quiz / explain) on a scope of a book. */
export async function runTask(book: Book, scope: Scope, kind: TaskKind, opts: StreamOptions, extra?: string): Promise<string> {
  const client = getClient();
  const context = await buildContext(book, scope);
  if (!context.trim()) {
    throw new Error("لا يوجد نص قابل للقراءة في هذا النطاق. قد يكون الملف ممسوحًا ضوئيًا (صور) ويحتاج إلى OCR.");
  }
  const header = `عنوان الكتاب: ${book.title}${book.author ? `\nالمؤلف: ${book.author}` : ""}\nالنطاق: ${scopeLabel(scope)} (إجمالي صفحات الكتاب: ${book.pages})`;

  if (context.length <= MAX_SINGLE_CHARS) {
    return streamOnce(
      client,
      SYSTEM,
      [{ role: "user", content: `${header}\n\n<book>\n${context}\n</book>\n\n${taskPrompt(kind, extra)}` }],
      opts,
    );
  }

  // Map-reduce for very long books: summarize each chunk, then run the task on the merged notes.
  const chunks = splitIntoChunks(context);
  const notes: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    opts.onDelta("", `_يُعالج الجزء ${i + 1} من ${chunks.length}…_`);
    const part = await streamOnce(
      client,
      SYSTEM,
      [
        {
          role: "user",
          content: `${header}\n\nهذا الجزء ${i + 1} من ${chunks.length} من الكتاب.\n<book>\n${chunks[i]}\n</book>\n\nاكتب ملاحظات مكثفة (حتى 900 كلمة) تلتقط كل الأفكار والحجج والأمثلة المهمة في هذا الجزء مع أرقام الصفحات. هذه الملاحظات ستُدمج لاحقًا، فلا تكتب مقدمة أو خاتمة.`,
        },
      ],
      { ...opts, onDelta: () => {}, signal: opts.signal },
    );
    notes.push(`<part index="${i + 1}">\n${part}\n</part>`);
  }
  return streamOnce(
    client,
    SYSTEM,
    [
      {
        role: "user",
        content: `${header}\n\nالنص التالي هو ملاحظات مفصلة مستخرجة من أجزاء الكتاب بالترتيب:\n<notes>\n${notes.join("\n")}\n</notes>\n\n${taskPrompt(kind, extra)}`,
      },
    ],
    opts,
  );
}

/** Multi-turn chat grounded in the book text. */
export async function chatWithBook(
  book: Book,
  scope: Scope,
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
  opts: StreamOptions,
): Promise<string> {
  const client = getClient();
  let context = await buildContext(book, scope);
  let truncatedNote = "";
  if (context.length > MAX_SINGLE_CHARS) {
    context = context.slice(0, MAX_SINGLE_CHARS);
    truncatedNote = "\n\n(ملاحظة: الكتاب طويل جدًا، وقد تم تضمين الجزء الأول منه فقط في هذه المحادثة.)";
  }
  const header = `عنوان الكتاب: ${book.title}${book.author ? `\nالمؤلف: ${book.author}` : ""}\nالنطاق المتاح: ${scopeLabel(scope)}${truncatedNote}`;

  // The document is the stable prefix (cached); the conversation follows it.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${header}\n\n<book>\n${context}\n</book>`,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: "سأطرح عليك أسئلة عن هذا الكتاب. أجب اعتمادًا على نصه مع ذكر الصفحات." },
      ],
    },
    { role: "assistant", content: "حسنًا، الكتاب أمامي. تفضل بسؤالك." },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];
  return streamOnce(client, SYSTEM, messages, opts);
}

/** Cheap connectivity/key check used by the settings screen. */
export async function testApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
    await client.models.retrieve("claude-opus-5");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}
