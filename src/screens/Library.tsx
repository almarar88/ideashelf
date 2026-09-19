import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Fuse from "fuse.js";
import { Heart, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { db, deleteBook, type Book } from "@/lib/db";
import type { Route } from "@/App";
import { UploadButton } from "@/components/UploadButton";
import { cn, formatBytes } from "@/lib/utils";

type Sort = "recent" | "added" | "title";

export function LibraryScreen({ navigate }: { navigate: (r: Route) => void }) {
  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [onlyFav, setOnlyFav] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const list = useMemo(() => {
    let l = books.slice();
    if (onlyFav) l = l.filter((b) => b.favorite);
    if (q.trim()) {
      const fuse = new Fuse(l, { keys: ["title", "author", "tags"], threshold: 0.4, ignoreLocation: true });
      l = fuse.search(q).map((r) => r.item);
    } else {
      l.sort((a, b) =>
        sort === "title" ? a.title.localeCompare(b.title, "ar") : sort === "added" ? b.addedAt - a.addedAt : b.lastOpenedAt - a.lastOpenedAt || b.addedAt - a.addedAt,
      );
    }
    return l;
  }, [books, q, sort, onlyFav]);

  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            المكتبة <span className="text-sm font-normal text-ink-muted">({books.length})</span>
          </h1>
          <UploadButton label="رفع PDF" className="h-10 px-4" />
        </div>
        <div className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-4">
          <Search size={16} className="text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن كتاب أو مؤلف…" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              ["recent", "الأحدث قراءة"],
              ["added", "الأحدث إضافة"],
              ["title", "الاسم"],
            ] as [Sort, string][]
          ).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium", sort === k ? "bg-ink text-cream" : "bg-white text-ink")}>
              {label}
            </button>
          ))}
          <button onClick={() => setOnlyFav((v) => !v)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium", onlyFav ? "bg-accent text-white" : "bg-white text-ink")}>
            <Heart size={12} className="inline me-1" />
            المفضلة
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar" onClick={() => setMenuFor(null)}>
        {list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-ink-muted">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-3xl">📚</div>
            <p className="text-sm">{books.length === 0 ? "لا توجد كتب بعد. ارفع ملف PDF للبدء." : "لا نتائج مطابقة."}</p>
            {books.length === 0 && <UploadButton />}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((b) => (
              <BookCard key={b.id} book={b} open={() => navigate({ name: "reader", target: { kind: "local", bookId: b.id } })} menuOpen={menuFor === b.id} toggleMenu={() => setMenuFor(menuFor === b.id ? null : b.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookCard({ book, open, menuOpen, toggleMenu }: { book: Book; open: () => void; menuOpen: boolean; toggleMenu: () => void }) {
  const pct = Math.round(((book.lastPage - 1) / Math.max(1, book.pages - 1)) * 100);
  return (
    <div className="rise relative overflow-hidden rounded-3xl bg-white p-3">
      <button onClick={open} className="block w-full text-start">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-cream-soft">
          {book.cover ? <img src={book.cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl">📄</div>}
          {book.favorite && (
            <span className="absolute start-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
              <Heart size={12} fill="currentColor" />
            </span>
          )}
          {!book.textExtracted && <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 py-0.5 text-center text-[10px] text-white">جارٍ استخراج النص…</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{book.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">{book.author || `${book.pages} صفحة · ${formatBytes(book.size)}`}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu();
        }}
        className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div className="absolute end-4 top-14 z-10 w-40 overflow-hidden rounded-2xl bg-ink text-cream shadow-lift" onClick={(e) => e.stopPropagation()}>
          <button className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-white/10" onClick={() => db.books.update(book.id, { favorite: !book.favorite })}>
            <Heart size={14} /> {book.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-300 hover:bg-white/10"
            onClick={() => {
              if (confirm(`حذف "${book.title}" وكل تحليلاته؟`)) void deleteBook(book.id);
            }}
          >
            <Trash2 size={14} /> حذف الكتاب
          </button>
        </div>
      )}
    </div>
  );
}
