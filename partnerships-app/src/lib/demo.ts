import type { Agreement, Deal, Meeting, Partner, Task } from "@/types";
import { addDays, todayISO, uid } from "./ids";

/** Sample data so the app is explorable on first launch. Clearly labelled as demo in Settings. */
export function seedDemo(): { partners: Partner[]; deals: Deal[]; agreements: Agreement[]; tasks: Task[]; meetings: Meeting[] } {
  const t = todayISO();
  const p1: Partner = {
    id: uid(), name: "مؤسسة النخبة للتقنية", type: "technology", status: "active", sector: "تقنية المعلومات", country: "الإمارات",
    website: "https://example.com", description: "شركة تقنية توفر حلول سحابية ومنصات رقمية للقطاع الحكومي والخاص.",
    tags: ["سحابة", "تحول رقمي"], contacts: [{ id: uid(), name: "م. سارة العتيبي", role: "مديرة الشراكات", email: "sara@example.com", phone: "+966500000001" }],
    ownerName: "أنا", lastContactAt: addDays(t, -3), createdAt: addDays(t, -120), notes: "مهتمون بتوقيع مذكرة تفاهم لبرنامج التدريب المشترك.",
  };
  const p2: Partner = {
    id: uid(), name: "جامعة المستقبل", type: "academic", status: "active", sector: "التعليم", country: "الإمارات",
    description: "جامعة رائدة في البحث والتطوير وريادة الأعمال.", tags: ["بحث", "تدريب"],
    contacts: [{ id: uid(), name: "د. خالد الحربي", role: "عميد التعاون الدولي", email: "khalid@example.edu" }],
    ownerName: "أنا", lastContactAt: addDays(t, -40), createdAt: addDays(t, -200), notes: "",
  };
  const p3: Partner = {
    id: uid(), name: "بنك الأمانة", type: "sponsor", status: "prospect", sector: "الخدمات المالية", country: "الإمارات",
    description: "بنك تجاري يبحث عن فرص رعاية مبادرات ريادة الأعمال.", tags: ["رعاية", "تمويل"],
    contacts: [{ id: uid(), name: "أ. منى الشامسي", role: "رئيسة المسؤولية المجتمعية" }],
    ownerName: "أنا", lastContactAt: addDays(t, -10), createdAt: addDays(t, -30), notes: "طلبوا عرض رعاية بثلاث باقات.",
  };
  const p4: Partner = {
    id: uid(), name: "مؤسسة دبي لتنمية الصادرات", type: "government", status: "active", sector: "حكومي", country: "الإمارات",
    description: "جهة حكومية تدعم برامج التصدير وبناء القدرات.", tags: ["حكومي", "تصدير"],
    contacts: [{ id: uid(), name: "أ. فهد القحطاني", role: "مدير الشراكات" }],
    ownerName: "أنا", lastContactAt: addDays(t, -1), createdAt: addDays(t, -300), notes: "",
  };
  const partners = [p1, p2, p3, p4];

  const deals: Deal[] = [
    { id: uid(), partnerId: p1.id, title: "مذكرة تفاهم – برنامج التدريب التقني", stage: "negotiation", value: 450000, currency: "AED", probability: 65, expectedCloseAt: addDays(t, 20), nextStep: "إرسال النسخة النهائية للمذكرة للمراجعة القانونية", updatedAt: addDays(t, -2), createdAt: addDays(t, -60), notes: "" },
    { id: uid(), partnerId: p3.id, title: "رعاية ذهبية – ملتقى الشراكات 2026", stage: "proposal", value: 250000, currency: "AED", probability: 40, expectedCloseAt: addDays(t, 35), nextStep: "عرض تقديمي لباقات الرعاية", updatedAt: addDays(t, -5), createdAt: addDays(t, -25), notes: "" },
    { id: uid(), partnerId: p2.id, title: "برنامج بحثي مشترك", stage: "contact", value: 120000, currency: "AED", probability: 25, expectedCloseAt: addDays(t, 75), nextStep: "تحديد نطاق البحث مع العميد", updatedAt: addDays(t, -30), createdAt: addDays(t, -45), notes: "" },
    { id: uid(), partnerId: p4.id, title: "تجديد اتفاقية بناء القدرات", stage: "renewal", value: 300000, currency: "AED", probability: 85, expectedCloseAt: addDays(t, 45), nextStep: "تقييم نتائج السنة الماضية", updatedAt: addDays(t, -1), createdAt: addDays(t, -400), notes: "" },
  ];

  const agreements: Agreement[] = [
    { id: uid(), partnerId: p4.id, title: "اتفاقية بناء القدرات التصديرية", type: "contract", status: "signed", startAt: addDays(t, -320), endAt: addDays(t, 45), value: 300000, currency: "AED", autoRenew: false, noticeDays: 60,
      obligations: [{ id: uid(), text: "تنفيذ 4 ورش تدريبية سنوياً", owner: "us", dueAt: addDays(t, 30), done: false }, { id: uid(), text: "توفير قاعات التدريب", owner: "partner", done: true }],
      summary: "شراكة لبناء قدرات المنشآت الصغيرة في التصدير.", createdAt: addDays(t, -320) },
    { id: uid(), partnerId: p1.id, title: "اتفاقية سرية – مشروع المنصة", type: "nda", status: "signed", startAt: addDays(t, -90), endAt: addDays(t, 275), value: 0, currency: "AED", autoRenew: true, noticeDays: 30, obligations: [], summary: "حماية المعلومات المتبادلة أثناء دراسة المنصة المشتركة.", createdAt: addDays(t, -90) },
    { id: uid(), partnerId: p2.id, title: "مذكرة تفاهم للتدريب التعاوني", type: "mou", status: "review", startAt: t, endAt: addDays(t, 365), value: 0, currency: "AED", autoRenew: false, noticeDays: 30, obligations: [{ id: uid(), text: "استقبال 10 متدربين سنوياً", owner: "us", done: false }], summary: "", createdAt: addDays(t, -7) },
  ];

  const tasks: Task[] = [
    { id: uid(), title: "مراجعة بنود مذكرة تفاهم النخبة", priority: "urgent", status: "open", dueAt: t, startTime: "08:00", endTime: "10:00", partnerId: p1.id, dealId: deals[0].id, assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "إعداد عرض باقات الرعاية لبنك الأمانة", priority: "medium", status: "open", dueAt: t, startTime: "11:00", endTime: "12:00", partnerId: p3.id, dealId: deals[1].id, assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "الاتصال بعميد جامعة المستقبل", priority: "normal", status: "open", dueAt: t, startTime: "13:00", endTime: "13:30", partnerId: p2.id, assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "تقرير أداء الشراكة مع هيئة الصادرات", priority: "medium", status: "open", dueAt: addDays(t, 1), startTime: "09:00", endTime: "11:00", partnerId: p4.id, assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "تحديث سجل الشركاء الربعي", priority: "normal", status: "open", dueAt: addDays(t, 2), assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "اجتماع تحضيري للملتقى", priority: "urgent", status: "open", dueAt: addDays(t, 2), startTime: "10:00", endTime: "11:00", assignee: "أنا", createdAt: t, source: "manual" },
    { id: uid(), title: "إرسال شكر بعد الاجتماع", priority: "normal", status: "done", dueAt: addDays(t, -1), assignee: "أنا", createdAt: addDays(t, -2), source: "manual" },
  ];

  const meetings: Meeting[] = [
    { id: uid(), title: "اجتماع تفاوض – مؤسسة النخبة", partnerId: p1.id, at: addDays(t, -2), attendees: ["م. سارة العتيبي", "أنا"], rawNotes: "ناقشنا مدة المذكرة (3 سنوات)، طلبوا بند حصرية للتدريب التقني في دبي. اتفقنا على مراجعة قانونية خلال أسبوعين. سارة سترسل قائمة المدربين. نحتاج تحديد حصة كل طرف من الرسوم.", createdAt: addDays(t, -2) },
  ];

  return { partners, deals, agreements, tasks, meetings };
}
