import { getJson } from "../lib/http.mjs";

/**
 * Wikimedia Commons — real photographs, no API key.
 *
 * Everything returned carries its licence and author because the CC licences
 * these files use require attribution. The client renders that credit; do not
 * strip it.
 */

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

const stripHtml = (s = "") =>
  s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Search Commons for photographs matching a term. */
export async function searchPhotos(term, { limit = 6, width = 800 } = {}) {
  const url =
    `${COMMONS}?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(term)}` +
    `&gsrnamespace=6&gsrlimit=${limit * 2}` +
    `&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=${width}`;

  const data = await getJson(url);
  const pages = Object.values(data?.query?.pages ?? {});

  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      // Diagrams, maps and SVGs are common in these results and read as
      // clip-art in a photo slot, so only real raster photographs pass.
      if (info.mime !== "image/jpeg" && info.mime !== "image/png") return null;
      const title = page.title.replace(/^File:/, "");
      if (/\b(map|locator|flag|coat of arms|logo|seal|diagram|plan|chart)\b/i.test(title)) return null;

      const meta = info.extmetadata ?? {};
      return {
        id: String(page.pageid),
        title,
        url: info.thumburl ?? info.url,
        fullUrl: info.url,
        width: info.thumbwidth ?? null,
        height: info.thumbheight ?? null,
        licence: stripHtml(meta.LicenseShortName?.value ?? "") || "See Commons",
        author: stripHtml(meta.Artist?.value ?? "") || "Unknown",
        descriptionUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

/** Lead photo, description and coordinates for a place, from Wikipedia. */
export async function placeSummary(title) {
  const data = await getJson(`${WIKI_SUMMARY}/${encodeURIComponent(title)}`);
  const image = data?.originalimage?.source ?? data?.thumbnail?.source ?? null;
  // Wikipedia's lead image is sometimes a locator map (Bali, for one), which
  // is useless as a destination photo — the caller falls back to a search.
  const looksLikeMap = image ? /\.svg|locator|map/i.test(image) : true;
  return {
    title: data?.title ?? title,
    description: data?.extract ?? "",
    shortDescription: data?.description ?? "",
    image: looksLikeMap ? null : image,
    thumbnail: looksLikeMap ? null : data?.thumbnail?.source ?? null,
    coordinates: data?.coordinates ?? null,
    url: data?.content_urls?.desktop?.page ?? null,
  };
}


/**
 * Ranks a Commons file title by how much it reads like a destination photo.
 * The search index happily returns Balinese manuscripts for "Bali", so titles
 * that describe documents, artefacts or diagrams are pushed out entirely.
 */
function sceneScore(title) {
  const t = title.toLowerCase();
  if (/\b(script|letter|font|manuscript|inscription|coin|stamp|banknote|logo|flag|seal|chart|graph|diagram|map)\b/.test(t)) {
    return -10;
  }
  let score = 0;
  if (/\b(panorama|skyline|cityscape|aerial|view|viewpoint)\b/.test(t)) score += 3;
  if (/\b(beach|sunset|harbou?r|mosque|temple|tower|bridge|square|street|old town|market)\b/.test(t)) score += 2;
  if (/\b(night|sunrise|landscape)\b/.test(t)) score += 1;
  return score;
}

/**
 * Best photo set for a destination: the Wikipedia lead image when it is an
 * actual photograph, topped up with Commons search results.
 */
export async function destinationPhotos(place, { limit = 5 } = {}) {
  // Commons search is loose: an OR-style query happily returns a sculpture in
  // the Netherlands for "Bali landmark". Searching the plain place name and
  // then requiring it in the file title is what keeps the set on-topic.
  const needle = place.toLowerCase().split(/[,(]/)[0].trim();
  const [summary, searched] = await Promise.all([
    placeSummary(place).catch(() => null),
    searchPhotos(place, { limit: limit * 4 })
      .then((list) => list.filter((p) => p.title.toLowerCase().includes(needle)))
      .then((list) => list.map((p) => ({ p, s: sceneScore(p.title) })).filter((x) => x.s > -5))
      .then((list) => list.sort((a, b) => b.s - a.s).map((x) => x.p))
      .catch(() => []),
  ]);

  const photos = [];
  if (summary?.image) {
    photos.push({
      id: `lead-${place}`,
      title: summary.title,
      url: summary.thumbnail ?? summary.image,
      fullUrl: summary.image,
      licence: "See Wikipedia",
      author: "Wikipedia contributors",
      descriptionUrl: summary.url,
    });
  }
  for (const p of searched) {
    if (photos.length >= limit) break;
    photos.push(p);
  }

  return {
    place,
    description: summary?.description ?? "",
    shortDescription: summary?.shortDescription ?? "",
    coordinates: summary?.coordinates ?? null,
    photos,
  };
}

/**
 * A photo for a specific hotel — only when the file title actually mentions
 * the hotel. Showing a random city photo as "this hotel" would misrepresent
 * the property, so an unmatched result is returned as a city photo instead,
 * flagged with `representative: false` for the UI to label honestly.
 */
export async function hotelPhoto(hotelName, cityName) {
  const tokens = hotelName
    .toLowerCase()
    .replace(/\b(hotel|resort|suites|residence|the|and|&|by|inn|house|court|grand)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);

  const matches = await searchPhotos(`${hotelName} ${cityName}`, { limit: 6 }).catch(() => []);
  const exact = matches.find((m) => {
    const title = m.title.toLowerCase();
    return tokens.length > 0 && tokens.every((t) => title.includes(t));
  });
  if (exact) return { ...exact, representative: true };

  const cityShots = await searchPhotos(`${cityName} cityscape`, { limit: 1 }).catch(() => []);
  return cityShots[0] ? { ...cityShots[0], representative: false } : null;
}
