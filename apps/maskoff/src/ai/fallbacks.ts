import type { Lang, Question, Roast, RoundResults } from "@/types/game";
import { similarity } from "./dedupe";

/* -------------------------------------------------------------------------- *
 *  Offline fallback bank.
 *
 *  Every LLM call in this app is allowed to fail. When it does, the round must
 *  still open on time — a social game whose daily drop depends on a third-party
 *  API being up is a game that dies on its first outage. So the bank is not a
 *  placeholder: it is the guaranteed floor of the experience.
 * -------------------------------------------------------------------------- */

const AR_BANK: Omit<Question, "question_id">[] = [
  { category: "money", question_text: "صاحبك المقرّب طلب منك يستلف مبلغ كبير، وأنت تعرف إنه ما بيرجّعه بسرعة. وش تسوي؟", options: [{ id: "A", text: "أعطيه وأعتبره هدية بصمت" }, { id: "B", text: "أعتذر وأقوله ما عندي" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "money", question_text: "طلعتوا عشرة وواحد ما أكل إلا سلطة، وجت الفاتورة. الحساب يتقسّم بالتساوي ولا كل واحد يدفع طلبه؟", options: [{ id: "A", text: "بالتساوي، لا تصغّرها" }, { id: "B", text: "كل واحد طلبه، هذا العدل" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "loyalty", question_text: "سمعت واحد يطقّ في صاحبك وهو مو موجود. تسكت ولا تدافع؟", options: [{ id: "A", text: "أدافع حتى لو صارت مشكلة" }, { id: "B", text: "أسكت وأنقل له الكلام بعدين" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "loyalty", question_text: "عرفت سر يخرب علاقة صاحبك بخطيبته. تقول ولا تدفن السر؟", options: [{ id: "A", text: "أقول له، يستاهل يعرف" }, { id: "B", text: "مو شغلي، أسكت" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "travel", question_text: "في سفرة القروب، واحد كل يوم يتأخر ساعة على الموعد. تنتظرونه ولا تطلعون؟", options: [{ id: "A", text: "نطلع بدونه، يلحقنا" }, { id: "B", text: "ننتظر، ما نفرّق القروب" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "travel", question_text: "حجزتوا شقة وحدة والغرف ناقصة. مين ينام على الكنبة؟", options: [{ id: "A", text: "اللي حجز آخر واحد" }, { id: "B", text: "قرعة، والكل يرضى" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "habits", question_text: "تشوف شخص يسوّي شي غلط قدامك في مكان عام. تتدخّل ولا تكمّل طريقك؟", options: [{ id: "A", text: "أتدخّل مباشرة" }, { id: "B", text: "أصوّر وأمشي" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "habits", question_text: "جاك رد على رسالتك بعد ثلاثة أيام. ترد فوراً ولا تأخّر عليه بالمثل؟", options: [{ id: "A", text: "أرد فوراً، ما عندي ألعاب" }, { id: "B", text: "أأخّر عليه نفس المدة" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "workplace", question_text: "مديرك أخذ فكرتك ونسبها لنفسه في الاجتماع. وش تسوي؟", options: [{ id: "A", text: "أوضّح قدام الكل" }, { id: "B", text: "أسكت وأحفظها له" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "workplace", question_text: "زميلك يشتغل أقل منك وراتبه أعلى. تواجه الإدارة ولا تدوّر شغل ثاني بصمت؟", options: [{ id: "A", text: "أواجه وأطالب بحقي" }, { id: "B", text: "أدوّر بديل وأطلع" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "money", question_text: "ربحت مبلغ كبير فجأة. تقول للقروب ولا تخفيها؟", options: [{ id: "A", text: "أقول، هذولا أهلي" }, { id: "B", text: "أخفيها، تتغيّر النظرات" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "loyalty", question_text: "صاحبك طلب منك تكذب على أهله عشانه. تكذب؟", options: [{ id: "A", text: "أكذب، هذا الصاحب" }, { id: "B", text: "أرفض، ما أدخل بينهم" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "habits", question_text: "استعار منك شي غالي ورجّعه مكسور وقال ما انتبه. وش تسوي؟", options: [{ id: "A", text: "أطالبه يصلّحه" }, { id: "B", text: "أقول عادي وما أعيرهم شي بعدها" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "travel", question_text: "في المطار، صاحبك وزنه زايد ويبي يحط أغراضه في شنطتك. توافق؟", options: [{ id: "A", text: "أوافق، بسيطة" }, { id: "B", text: "أرفض، كل واحد ومسؤوليته" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "workplace", question_text: "زميلك طلب منك تغطّي غيابه وأنت تعرف إنه مو مريض. تغطّي؟", options: [{ id: "A", text: "أغطّي، مرة وحدة" }, { id: "B", text: "ما أكذب على أحد" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "habits", question_text: "شفت رسالة على جوال شخص قريب منك بالغلط وفيها شي مريب. تفتحها؟", options: [{ id: "A", text: "أفتح، لازم أعرف" }, { id: "B", text: "أقفل وأتجاهل" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "money", question_text: "الكاشير نسي يحسب عليك أغلى غرض. ترجع ولا تمشي؟", options: [{ id: "A", text: "أرجع وأدفع" }, { id: "B", text: "أمشي، مو غلطتي" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "loyalty", question_text: "صاحبك القديم رجع بعد ما اختفى سنتين في أصعب وقت عليك. تستقبله؟", options: [{ id: "A", text: "أستقبله عادي" }, { id: "B", text: "أبرد معه، راح وقته" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "travel", question_text: "القروب يبي يغيّر الخطة كلها في آخر لحظة وأنت مرتب وقتك. توافق ولا تعاند؟", options: [{ id: "A", text: "أمشي معهم" }, { id: "B", text: "أكمّل خطتي لحالي" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
  { category: "workplace", question_text: "عرض شغل براتب أعلى بس مع ناس ما ترتاح لهم. تقبل؟", options: [{ id: "A", text: "أقبل، الفلوس فلوس" }, { id: "B", text: "أرفض، راحتي أهم" }], stake_prompt: "مين في القروب أكثر واحد بيختار A؟" },
];

const EN_BANK: Omit<Question, "question_id">[] = [
  { category: "money", question_text: "Your closest friend asks to borrow a serious amount, and you know you'll never see it again. What do you do?", options: [{ id: "A", text: "Give it and quietly write it off" }, { id: "B", text: "Say you don't have it" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "money", question_text: "Ten of you ate out, one person had a salad, and the bill just landed. Split evenly or pay your own?", options: [{ id: "A", text: "Split evenly, don't be that person" }, { id: "B", text: "Everyone pays their own, that's fair" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "loyalty", question_text: "Someone trashes your friend while they're not in the room. Do you push back or let it slide?", options: [{ id: "A", text: "Push back, even if it gets awkward" }, { id: "B", text: "Stay quiet, tell them later" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "loyalty", question_text: "You learn something that would end your friend's relationship. Tell them or bury it?", options: [{ id: "A", text: "Tell them, they deserve to know" }, { id: "B", text: "Not my business" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "travel", question_text: "On the group trip, one person is an hour late every single day. Wait or leave?", options: [{ id: "A", text: "Leave, they can catch up" }, { id: "B", text: "Wait, we don't split the group" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "travel", question_text: "The rental is one bed short. Who takes the couch?", options: [{ id: "A", text: "Whoever booked last" }, { id: "B", text: "Draw for it, no arguments" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "habits", question_text: "You see someone doing something clearly wrong in public. Step in or keep walking?", options: [{ id: "A", text: "Step in immediately" }, { id: "B", text: "Film it and keep walking" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "habits", question_text: "They replied to your message three days later. Reply instantly or make them wait the same?", options: [{ id: "A", text: "Reply instantly, I don't play games" }, { id: "B", text: "Make them wait exactly as long" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "workplace", question_text: "Your manager presented your idea as their own in the meeting. What now?", options: [{ id: "A", text: "Correct it in front of everyone" }, { id: "B", text: "Say nothing and remember it" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "workplace", question_text: "A coworker does less than you and earns more. Confront management or quietly job-hunt?", options: [{ id: "A", text: "Confront them and ask for more" }, { id: "B", text: "Find something else and leave" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "money", question_text: "You suddenly come into a large amount of money. Tell the group or keep it quiet?", options: [{ id: "A", text: "Tell them, they're my people" }, { id: "B", text: "Keep quiet, people change" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "loyalty", question_text: "Your friend asks you to lie to their family for them. Do you?", options: [{ id: "A", text: "Lie, that's what friends do" }, { id: "B", text: "Refuse, I'm not getting involved" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "habits", question_text: "They borrowed something expensive and returned it broken, claiming they didn't notice. What now?", options: [{ id: "A", text: "Ask them to replace it" }, { id: "B", text: "Say it's fine and never lend again" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "travel", question_text: "At the airport your friend is overweight and wants to stuff their things in your bag. Yes or no?", options: [{ id: "A", text: "Sure, no big deal" }, { id: "B", text: "No, pack your own problem" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "workplace", question_text: "A coworker asks you to cover for an absence you know is fake. Do you cover?", options: [{ id: "A", text: "Cover, just this once" }, { id: "B", text: "I don't lie for anyone" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "habits", question_text: "You accidentally see a suspicious message on someone close to you. Open it?", options: [{ id: "A", text: "Open it, I need to know" }, { id: "B", text: "Close it and let it go" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "money", question_text: "The cashier forgot to scan the most expensive item. Go back or walk?", options: [{ id: "A", text: "Go back and pay" }, { id: "B", text: "Walk, not my mistake" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "loyalty", question_text: "An old friend who vanished during your worst year is back. Let them in?", options: [{ id: "A", text: "Let them in, no grudges" }, { id: "B", text: "Keep them at a distance" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "travel", question_text: "The group wants to scrap the whole plan last minute and you'd already scheduled your day. Go along?", options: [{ id: "A", text: "Go along with them" }, { id: "B", text: "Do my own plan alone" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
  { category: "workplace", question_text: "A higher-paying job, but with people you don't trust. Take it?", options: [{ id: "A", text: "Take it, money is money" }, { id: "B", text: "Pass, peace of mind wins" }], stake_prompt: "Who in your group is most likely to choose Option A?" },
];

/**
 * Pick the bank entry least similar to everything already played, so the
 * offline path degrades gracefully instead of looping the same three cards.
 */
export function fallbackQuestion(lang: Lang, history: string[], roundNumber: number): Question {
  const bank = lang === "ar" ? AR_BANK : EN_BANK;

  let best = bank[roundNumber % bank.length];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const entry of bank) {
    const worst = history.reduce((max, past) => Math.max(max, similarity(entry.question_text, past)), 0);
    if (worst < bestScore) {
      bestScore = worst;
      best = entry;
      if (worst === 0) break;
    }
  }

  return { ...best, question_id: `fallback-${lang}-${roundNumber}-${Date.now().toString(36)}` };
}

/**
 * Deterministic roast built from the computed results. It is intentionally
 * mechanical — it states what happened rather than pretending to be witty,
 * because a bad joke is worse than a clean fact.
 */
export function fallbackRoast(lang: Lang, results: RoundResults, names: Record<string, string>): Roast {
  const mvp = results.mvpUserId ? names[results.mvpUserId] ?? "—" : null;
  const hypocrite = results.hypocriteUserId ? names[results.hypocriteUserId] ?? "—" : null;
  const a = results.tally.A.length;
  const b = results.tally.B.length;

  if (lang === "ar") {
    return {
      roast_headline: a === b ? "القروب انقسم نصين" : a > b ? "الأغلبية اختارت A" : "الأغلبية اختارت B",
      roast_commentary: [
        `النتيجة: ${a} مع A و ${b} مع B.`,
        mvp ? `${mvp} قرأ القروب صح أكثر من الكل.` : "ما في أحد قرأ القروب صح هالمرة.",
        hypocrite ? `و${hypocrite} طلع عكس اللي الكل متوقعه منه.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      mvp_perceptive_user_id: results.mvpUserId ?? "",
      biggest_hypocrite_user_id: results.hypocriteUserId ?? "",
    };
  }

  return {
    roast_headline: a === b ? "Dead even split" : a > b ? "Option A took it" : "Option B took it",
    roast_commentary: [
      `Final count: ${a} for A, ${b} for B.`,
      mvp ? `${mvp} read the room better than anyone.` : "Nobody read the room this time.",
      hypocrite ? `And ${hypocrite} went the exact opposite way everyone predicted.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    mvp_perceptive_user_id: results.mvpUserId ?? "",
    biggest_hypocrite_user_id: results.hypocriteUserId ?? "",
  };
}
