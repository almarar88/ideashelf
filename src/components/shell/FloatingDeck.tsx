import { DeckCard, deckItems } from "./deck";
import type { ScreenId } from "@/lib/types";

/**
 * بطاقات عائمة حول الجهاز على الشاشات الواسعة — مستوحاة من تخطيط المرجع البصري،
 * لكنها هنا حيّة: تعرض حالة التطبيق الفعلية لا زخرفة ثابتة.
 */
export function FloatingDeck({
  screen,
  busy,
  seals,
}: {
  screen: ScreenId;
  busy: boolean;
  seals: number;
}) {
  const items = deckItems(screen, busy, seals);
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[26vw] max-w-[330px] flex-col justify-center gap-5 pr-6 xl:flex">
        {items.slice(0, 2).map((item, i) => (
          <DeckCard
            key={item.key}
            item={item}
            className="pointer-events-auto animate-floaty"
            style={{ animationDelay: `${i * 1.2}s` }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[26vw] max-w-[330px] flex-col justify-center gap-5 pl-6 xl:flex">
        {items.slice(2).map((item, i) => (
          <DeckCard
            key={item.key}
            item={item}
            className="pointer-events-auto animate-floaty"
            style={{ animationDelay: `${0.6 + i * 0.6}s` }}
          />
        ))}
      </div>
    </>
  );
}
