import type { Group, Player } from "@/types/game";

export const DEMO_PLAYERS: Player[] = [
  { id: "u_you", name: "أنت / You", emoji: "🫵", accent: "grape" },
  { id: "u_sara", name: "سارة", emoji: "🦊", accent: "coral" },
  { id: "u_faisal", name: "فيصل", emoji: "🐺", accent: "ice" },
  { id: "u_nora", name: "نورة", emoji: "🐱", accent: "pistachio" },
  { id: "u_omar", name: "عمر", emoji: "🦁", accent: "butter" },
  { id: "u_layla", name: "ليلى", emoji: "🦋", accent: "neon" },
];

export function seedGroup(timezone: string): Group {
  return {
    id: "g_demo",
    name: "الشلّة",
    inviteCode: "MASK-2049",
    lang: "ar",
    timezone,
    dropHour: 20,
    revealHour: 21,
    members: DEMO_PLAYERS,
    streak: 6,
    lastPerfectDay: null,
  };
}
