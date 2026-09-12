import { StudioScreen } from "./StudioScreen";
import { ProseScreen } from "./ProseScreen";
import { Pill } from "@/components/ui/Pill";

export type CreateTab = "film" | "essay";

/** مركز الإنشاء: الاستوديو السينمائي ومحرك المقالات تحت لسان واحد. */
export function CreateScreen({
  tab,
  onTab,
  running,
  onRun,
  onDone,
  dictating,
  onDictationEnd,
}: {
  tab: CreateTab;
  onTab: (t: CreateTab) => void;
  running: boolean;
  onRun: () => void;
  onDone: () => void;
  dictating: boolean;
  onDictationEnd: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 px-4 pb-2 pt-1">
        <Pill active={tab === "film"} onClick={() => onTab("film")}>
          فيلم
        </Pill>
        <Pill active={tab === "essay"} onClick={() => onTab("essay")}>
          مقال
        </Pill>
      </div>
      {tab === "film" ? (
        <StudioScreen running={running} onRun={onRun} onDone={onDone} />
      ) : (
        <ProseScreen dictating={dictating} onDictationEnd={onDictationEnd} />
      )}
    </div>
  );
}
