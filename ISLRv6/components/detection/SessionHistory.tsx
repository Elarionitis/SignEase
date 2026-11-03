import { motion, AnimatePresence } from "framer-motion";
import { IoTrashOutline, IoVolumeHigh } from "react-icons/io5";
import { cn } from "@/lib/utils";
import { formatSign } from "./PracticeCard";

export interface HistoryEntry {
  id: number;
  sign: string;
  confidence: number;
  matched?: boolean;
}

interface SessionHistoryProps {
  entries: HistoryEntry[];
  onSpeakAll: () => void;
  onClear: () => void;
  lowConfidence: number;
}

/** Signs recognised this visit, in order, so they read as a sentence. */
export function SessionHistory({ entries, onSpeakAll, onClear, lowConfidence }: SessionHistoryProps) {
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-xl border border-white/[0.05] bg-white/[0.02] p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-white/80">Your signs this session</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSpeakAll}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-200 transition-colors hover:bg-indigo-500/25"
          >
            <IoVolumeHigh /> Speak sentence
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear history"
            className="inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            <IoTrashOutline />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.span
              key={entry.id}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm capitalize",
                entry.matched
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : entry.confidence < lowConfidence
                    ? "border-amber-400/20 bg-amber-500/5 text-white/60"
                    : "border-white/10 bg-white/5 text-white/85"
              )}
              title={`${Math.round(entry.confidence * 100)}% confidence`}
            >
              {formatSign(entry.sign)}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
