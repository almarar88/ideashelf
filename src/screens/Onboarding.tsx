import { useState } from "react";
import { Button } from "@/components/ui";

export function OnboardingScreen({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex h-full items-center justify-center bg-cream md:bg-[var(--bg)] md:p-8" style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-cream md:h-auto md:max-w-3xl md:flex-row md:rounded-4xl md:shadow-lift">
      <div className="relative flex-1 overflow-hidden bg-ink text-cream md:min-h-[460px]">
        <div className="absolute -end-20 -top-20 h-72 w-72 rounded-full bg-accent/20" />
        <div className="absolute -start-24 bottom-10 h-64 w-64 rounded-full bg-cream/5" />
        <div className="relative flex h-full flex-col justify-end p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">‹›</div>
          <h1 className="text-4xl font-bold leading-tight">
            مكتبة الكود
            <br />
            الرقمية
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-7 text-cream/70">
            ارفع كتبك بصيغة PDF، اقرأها من أي مكان، ولخّصها وحلّلها واسألها بالذكاء الاصطناعي.
          </p>
        </div>
      </div>
      <div className="p-6 md:flex md:w-80 md:flex-col md:justify-center">
        <label className="mb-2 block text-sm font-medium">ما اسمك؟</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: نيكول"
          className="mb-4 h-12 w-full rounded-full bg-white px-5 text-sm outline-none ring-accent focus:ring-2"
        />
        <Button tone="dark" className="w-full" onClick={() => onDone(name.trim())}>
          ابدأ الآن
        </Button>
      </div>
      </div>
    </div>
  );
}
