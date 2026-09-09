import { Bath, Car, Coffee, Dumbbell, ExternalLink, MapPin, Plane, ShieldCheck, Star, Waves, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { DestinationArt } from "@/components/Art";
import Photo, { PhotoCredit } from "@/components/Photo";
import PriceCompare from "@/components/PriceCompare";
import { BackButton, Stars } from "@/components/ui";
import { cityById } from "@/data/catalog";
import { quoteTotal, searchHotels } from "@/lib/aggregator";
import { hotelBookingUrl, openBookingSite, savedBooking } from "@/lib/booking";
import { addDays, iso, money, todayISO } from "@/lib/format";
import { providerById } from "@/data/catalog";
import type { Hotel } from "@/lib/types";
import { useStore } from "@/state/store";

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  wifi: Wifi,
  pool: Waves,
  gym: Dumbbell,
  spa: Bath,
  parking: Car,
  breakfast: Coffee,
  beach: Waves,
  airport: Plane,
};

export default function HotelDetail() {
  const { hotelId } = useParams();
  const location = useLocation() as { state?: { hotel?: Hotel; nights?: number } };
  const { t, locale, currency, profile, dispatch } = useStore();
  const [selected, setSelected] = useState<string | null>(null);

  const nights = location.state?.nights ?? 3;
  const checkIn = addDays(todayISO(), 14);

  const hotel = useMemo(() => {
    if (location.state?.hotel) return location.state.hotel;
    // Rebuild from the id so a refresh or a deep link still resolves.
    const cityId = hotelId?.split("-")[1] ?? "dxb";
    return searchHotels({ cityId, checkInISO: checkIn, nights, guests: 2, rooms: 1 }).find((h) => h.id === hotelId) ?? null;
  }, [location.state, hotelId, checkIn, nights]);

  if (!hotel) {
    return (
      <div className="screen px-5 pt-safe">
        <BackButton />
        <p className="mt-10 text-center text-[14px] text-ink-muted">{t("noResults")}</p>
      </div>
    );
  }

  const city = cityById(hotel.cityId);
  const quote = hotel.quotes.find((q) => q.providerId === selected) ?? hotel.quotes[0];
  const total = quoteTotal(quote) * nights;

  const checkOut = addDays(checkIn, nights);
  const providerName = providerById(quote.providerId, quote.providerName).name;
  const bookingUrl = hotelBookingUrl(hotel, checkIn, checkOut, 2);

  const book = () => {
    dispatch({
      type: "addBooking",
      booking: savedBooking({
        kind: "hotel",
        refId: hotel.id,
        title: locale === "ar" ? hotel.nameAr : hotel.name,
        subtitle: `${locale === "ar" ? city.nameAr : city.name} · ${iso(nights)} ${t("nights")}`,
        dateISO: `${checkIn}T14:00:00`,
        price: total,
        passenger: profile.name,
        bookingUrl,
        provider: providerName,
      }),
    });
    openBookingSite(bookingUrl);
  };

  return (
    <div className="screen pb-40">
      <div className="relative h-[240px]">
        <Photo
          photo={hotel.photo}
          alt={hotel.name}
          showCredit={false}
          className="absolute inset-0 h-full w-full"
          fallback={<DestinationArt name={city.image} className="h-full w-full" />}
        />
        <div className="relative px-5 pt-safe">
          <BackButton />
        </div>
      </div>

      <div className="relative -mt-8 mx-5 card p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-extrabold leading-tight">{locale === "ar" ? hotel.nameAr : hotel.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
              <MapPin size={12} /> {locale === "ar" ? hotel.areaAr : hotel.area} · {iso(`${hotel.distanceKm} km`)}
            </p>
            {hotel.stars > 0 && (
              <div className="mt-2">
                <Stars value={hotel.stars} />
              </div>
            )}
            {hotel.address && <p className="mt-1.5 text-[11px] text-ink-faint">{hotel.address}</p>}
          </div>
          {hotel.rating > 0 && (
            <span className="shrink-0 rounded-2xl bg-brand px-3 py-2 text-center text-white">
              <span className="block text-[16px] font-extrabold leading-none">{hotel.rating}</span>
              <span className="block text-[9px] opacity-80">{hotel.reviews} {t("reviews")}</span>
            </span>
          )}
        </div>

        {hotel.roomDescription && (
          <p className="mt-3 border-t border-canvas pt-3 text-[12.5px] leading-relaxed text-ink-soft">
            {hotel.roomDescription}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-canvas pt-4">
          {hotel.board && <span className="chip bg-mint-100 text-[11px] text-mint-600">{hotel.board}</span>}
          {hotel.amenities.map((a) => {
            const Icon = AMENITY_ICONS[a] ?? Star;
            return (
              <span key={a} className="chip bg-canvas text-[11px] text-ink-soft">
                <Icon size={12} /> {a}
              </span>
            );
          })}
        </div>

        {hotel.freeCancel && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-mint-600">
            <ShieldCheck size={13} /> {t("freeCancellation")}
          </p>
        )}
      </div>

      <div className="mt-2 px-5">
        <PhotoCredit photo={hotel.photo} />
      </div>

      <section className="mt-5 px-5">
        <h2 className="mb-3 text-[17px] font-bold">{t("comparePrices")}</h2>
        <p className="mb-3 rounded-2xl bg-white px-4 py-3 text-[11.5px] leading-relaxed text-ink-muted shadow-soft">
          <span className="font-bold text-ink-soft">{t("handoffTitle")}.</span> {t("handoffBody")}
        </p>
        <PriceCompare quotes={hotel.quotes} unitLabel={t("perNight")} selectedId={quote.providerId} onSelect={(q) => setSelected(q.providerId)} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[440px] border-t border-canvas-deep/60 bg-white/95 px-5 pb-safe pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-ink-muted">
              {iso(nights)} {t("nights")} · {t("via")} {providerName}
            </p>
            <p className="text-[20px] font-extrabold leading-tight">{money(total, currency)}</p>
          </div>
          <button type="button" onClick={book} className="btn-dark shrink-0 gap-2 px-5 py-4 text-[14px]">
            <ExternalLink size={16} />
            {t("continueBooking")}
          </button>
        </div>
      </div>
    </div>
  );
}
