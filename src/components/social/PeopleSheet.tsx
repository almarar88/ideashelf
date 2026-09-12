import { Sheet } from "@/components/ui/Sheet";
import { PersonRow } from "./PersonRow";
import { useStore } from "@/store/store";

export function PeopleSheet({
  open,
  kind,
  onClose,
}: {
  open: boolean;
  kind: "following" | "followers";
  onClose: () => void;
}) {
  const { state } = useStore();
  const ids = kind === "following" ? state.following : state.followers;
  const list = state.people.filter((p) => ids.includes(p.id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind === "following" ? "يتابع" : "المتابِعون"}
      subtitle={`${list.length} حساب`}
    >
      <div className="space-y-1 pb-3">
        {list.map((p) => (
          <PersonRow key={p.id} person={p} />
        ))}
        {list.length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted">القائمة فارغة.</p>
        )}
      </div>
    </Sheet>
  );
}
