import { CheckCircle2, Download, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, Toast } from "@/components/ui";
import { clock, formatDate, money } from "@/lib/format";
import { makeRng } from "@/lib/rng";
import { useStore } from "@/state/store";

/** Code 128-style bar pattern, drawn from the booking code so it is stable. */
function Barcode({ code }: { code: string }) {
  const bars = useMemo(() => {
    const rng = makeRng("barcode", code);
    return Array.from({ length: 58 }, () => rng.pick([1, 1.5, 2, 3, 4]));
  }, [code]);
  const total = bars.reduce((s, w) => s + w + 1.6, 0);

  return (
    <svg viewBox={`0 0 ${total} 44`} className="h-11 w-full" preserveAspectRatio="none" role="img" aria-label={code}>
      {
        bars.reduce<{ x: number; nodes: JSX.Element[] }>(
          (acc, w, i) => {
            acc.nodes.push(<rect key={i} x={acc.x} y={0} width={w} height={44} fill="#12122B" />);
            acc.x += w + 1.6;
            return acc;
          },
          { x: 0, nodes: [] },
        ).nodes
      }
    </svg>
  );
}

export default function Ticket() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { t, locale, currency, bookings } = useStore();
  const [toast, setToast] = useState<string | null>(null);

  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    return (
      <div className="screen px-5 pt-safe">
        <BackButton onClick={() => navigate("/trips")} />
        <p className="mt-10 text-center text-[14px] text-ink-muted">{t("noBookings")}</p>
      </div>
    );
  }

  const passSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" rx="28" fill="#ffffff"/>
  <text x="36" y="60" font-family="sans-serif" font-size="16" fill="#8B8BA7">Alcode Trips · ${booking.code}</text>
  <text x="36" y="112" font-family="sans-serif" font-size="34" font-weight="700" fill="#12122B">${booking.title}</text>
  <text x="36" y="152" font-family="sans-serif" font-size="18" fill="#4A4A68">${booking.subtitle}</text>
  <text x="36" y="206" font-family="sans-serif" font-size="14" fill="#8B8BA7">Passenger</text>
  <text x="36" y="232" font-family="sans-serif" font-size="22" font-weight="700" fill="#12122B">${booking.passenger}</text>
  <text x="330" y="206" font-family="sans-serif" font-size="14" fill="#8B8BA7">Gate / Seat</text>
  <text x="330" y="232" font-family="sans-serif" font-size="22" font-weight="700" fill="#12122B">${booking.gate ?? "—"} · ${booking.seat ?? "—"}</text>
  <text x="36" y="290" font-family="sans-serif" font-size="14" fill="#8B8BA7">${formatDate(booking.dateISO, "en")} · ${clock(booking.dateISO)}</text>
</svg>`;

  const download = () => {
    try {
      const blob = new Blob([passSvg()], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alcode-${booking.code}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick so the download has taken the reference.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast(t("downloadTicket"));
    } catch {
      setToast(t("help"));
    }
  };

  const share = async () => {
    const text = `${booking.title} · ${booking.code} · ${formatDate(booking.dateISO, locale)}`;
    try {
      if (navigator.share) await navigator.share({ title: "Alcode Trips", text });
      else {
        await navigator.clipboard.writeText(text);
        setToast(t("copied"));
      }
    } catch {
      /* Dismissed. */
    }
  };

  return (
    <div className="screen bg-brand-50 pb-8">
      <header className="flex items-center gap-2.5 px-5 pt-safe">
        <BackButton onClick={() => navigate("/trips")} />
        <div className="ms-auto">
          <button type="button" aria-label={t("share")} onClick={share} className="icon-btn">
            <Share2 size={18} strokeWidth={2.4} />
          </button>
        </div>
      </header>

      <div className="mx-5 mt-4 flex items-center gap-2.5 rounded-3xl bg-white/70 px-4 py-3">
        <CheckCircle2 size={20} className="text-mint-600" />
        <p className="text-[13px] font-bold text-mint-600">{t("bookingConfirmed")}</p>
      </div>

      <div className="mx-5 mt-4 overflow-hidden rounded-[30px] bg-white shadow-card">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-[12px] font-extrabold text-brand">
              AL
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-ink-muted">{t("boardingPass")}</p>
              <p className="truncate text-[16px] font-extrabold leading-tight">{booking.subtitle}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3" dir="ltr">
            <div>
              <p className="text-[22px] font-extrabold leading-none">{booking.title.split("→")[0].trim()}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{clock(booking.dateISO)}</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-muted">{formatDate(booking.dateISO, locale, "short")}</span>
              <span className="dotted-line h-px w-full" />
            </div>
            <div className="text-end">
              <p className="text-[22px] font-extrabold leading-none">{booking.title.split("→")[1]?.trim() ?? "—"}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{t("gate")} {booking.gate}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: t("gate"), value: booking.gate ?? "—" },
              { label: t("seat"), value: booking.seat ?? "—" },
              { label: t("total"), value: money(booking.price, currency) },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-canvas px-3 py-2.5 text-center">
                <p className="text-[10px] text-ink-muted">{f.label}</p>
                <p className="mt-0.5 text-[15px] font-extrabold">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-[11px] text-ink-muted">{t("passengerName")}</p>
            <p className="text-[18px] font-extrabold">{booking.passenger}</p>
          </div>
        </div>

        {/* Perforation: two notches biting into the card plus a dashed rule. */}
        <div className="relative h-6">
          <span className="absolute -start-3 top-0 h-6 w-6 rounded-full bg-brand-50" />
          <span className="absolute -end-3 top-0 h-6 w-6 rounded-full bg-brand-50" />
          <span className="dotted-line absolute inset-x-6 top-3 h-px" />
        </div>

        <div className="px-5 pb-6 pt-1">
          <Barcode code={booking.code} />
          <p className="mt-2 text-center text-[12px] font-semibold tracking-[0.3em] text-ink-soft">{booking.code}</p>
        </div>
      </div>

      <div className="mx-5 mt-5">
        <button type="button" onClick={download} className="btn-dark w-full gap-2 py-4 text-[15px]">
          <Download size={18} /> {t("downloadTicket")}
        </button>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
