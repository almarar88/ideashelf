import { useEffect, useMemo, useState } from "react";
import { BookMarked, MapPin, Search, Sparkles } from "lucide-react";
import { SectionTitle } from "./StudioScreen";
import { LifeMap } from "@/components/atlas/LifeMap";
import { Pill } from "@/components/ui/Pill";
import { atlas, recallExamples } from "@/lib/data";
import { recall, relatedPosts } from "@/lib/engine";
import type { AtlasMoment } from "@/lib/types";

export function AtlasScreen({ focusSearch }: { focusSearch: number }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AtlasMoment | null>(null);
  const [memoir, setMemoir] = useState(false);
  const [year, setYear] = useState<number | "all">("all");

  useEffect(() => {
    if (focusSearch > 0) {
      document.getElementById("recall-input")?.focus();
    }
  }, [focusSearch]);

  const hits = useMemo(() => (query.trim() ? recall(query) : []), [query]);
  const highlighted = useMemo(() => new Set(hits.map((h) => h.moment.id)), [hits]);

  const years = useMemo(
    () => Array.from(new Set(atlas.map((m) => m.year))).sort((a, b) => b - a),
    [],
  );
  const timeline = useMemo(
    () =>
      [...atlas]
        .filter((m) => year === "all" || m.year === year)
        .sort((a, b) => b.year - a.year || b.x - a.x),
    [year],
  );

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
      <SectionTitle
        title="أطلس الحياة الحي"
        subtitle="لا شبكة صور مربعة — مسار مكاني وزمني تتوزع عليه رحلاتك وكتاباتك ومحطاتك."
      />

      <div className="card p-3">
        <div className="mb-2 flex items-center gap-2 rounded-full bg-raised px-3 py-2">
          <Search size={15} className="shrink-0 text-iris" />
          <input
            id="recall-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="صف اليوم بدل أن تبحث بكلمة…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {recallExamples.map((ex) => (
            <Pill key={ex} onClick={() => setQuery(ex)} className="max-w-[70%]">
              <span className="truncate">{ex}</span>
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <LifeMap
          moments={atlas}
          highlighted={highlighted}
          selectedId={selected?.id ?? null}
          onSelect={(m) => setSelected(m)}
        />
      </div>

      {query.trim() && (
        <div className="depth-enter mt-3 card p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Sparkles size={14} className="text-rose" />
            الاسترجاع السياقي — {hits.length} نتيجة
          </p>
          {hits.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              لا يوجد في أرشيفك ما يطابق هذا الوصف. المحرك لا يؤلّف ذكرى لم تحدث.
            </p>
          ) : (
            <ul className="space-y-2">
              {hits.map((h) => (
                <li key={h.moment.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(h.moment)}
                    className="w-full rounded-xl2 bg-raised p-3 text-right"
                  >
                    <p className="text-[13px] font-semibold">{h.moment.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      <bdi>{h.moment.place}</bdi> · <bdi>{h.moment.date} {h.moment.year}</bdi>
                    </p>
                    <p className="mt-1 text-[11px] text-iris">
                      طابق: {h.matched.join("، ")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className="depth-enter mt-3 card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold">{selected.title}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted">
                <MapPin size={12} />
                <bdi>{selected.place}</bdi> · <bdi>{selected.date} {selected.year}</bdi> ·{" "}
                {selected.season}
              </p>
            </div>
            <span className="rounded-full bg-raised px-2.5 py-1 text-[10.5px] text-muted">
              {selected.kind}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed">{selected.note}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.tags.map((t) => (
              <span key={t} className="rounded-full bg-raised px-2.5 py-1 text-[10.5px] text-muted">
                #{t}
              </span>
            ))}
          </div>
          {relatedPosts(selected).length > 0 && (
            <p className="mt-3 text-[11.5px] text-muted">
              مرتبط بـ {relatedPosts(selected).length} منشور في المجرى.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        <Pill active={year === "all"} onClick={() => setYear("all")}>
          كل السنوات
        </Pill>
        {years.map((y) => (
          <Pill key={y} active={year === y} onClick={() => setYear(y)}>
            {y}
          </Pill>
        ))}
      </div>

      <ol className="relative mt-3 space-y-3 pr-4">
        <span className="absolute bottom-2 right-[7px] top-2 w-px bg-line" aria-hidden />
        {timeline.map((m) => (
          <li key={m.id} className="relative">
            <span className="absolute right-[-14px] top-3 h-2.5 w-2.5 rounded-full bg-iris" />
            <button
              type="button"
              onClick={() => setSelected(m)}
              className="w-full rounded-xl2 bg-surface/70 p-3 text-right transition hover:bg-surface"
            >
              <p className="text-[13px] font-semibold">{m.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                <bdi>{m.date} {m.year}</bdi> · <bdi>{m.place}</bdi>
              </p>
            </button>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setMemoir((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-surface py-3 text-[13.5px] font-semibold shadow-lift transition active:scale-[.98]"
      >
        <BookMarked size={16} className="text-amber" />
        {memoir ? "إخفاء السيرة" : "اجمع سيرة هذه السنة"}
      </button>

      {memoir && (
        <div className="depth-enter card mt-3 p-4">
          <p className="text-[11.5px] text-muted">سيرة ذاتية مجمّعة تلقائياً</p>
          <h3 className="mt-0.5 font-serif text-[17px] font-semibold">أثر 2025</h3>
          <ol className="mt-3 space-y-2">
            {atlas
              .filter((m) => m.year === 2025)
              .map((m, i) => (
                <li key={m.id} className="flex gap-2 text-[12.5px]">
                  <span className="w-5 shrink-0 tabular-nums text-muted">{i + 1}.</span>
                  <span>
                    <span className="font-medium">{m.title}</span>
                    <span className="text-muted"> — {m.note}</span>
                  </span>
                </li>
              ))}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            الفصول مرتّبة زمنياً، وكل فصل يحمل مصادره من الأطلس. التصدير إلى ملف قابل
            للطباعة غير مفعّل في هذا النموذج.
          </p>
        </div>
      )}
    </div>
  );
}
