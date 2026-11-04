import { motion, AnimatePresence } from "framer-motion";
import { FaFire, FaRandom, FaTrophy } from "react-icons/fa";
import { cn } from "@/lib/utils";

export interface PracticeSign {
  name: string;
  index: number;
}

export type PracticeOutcome = "match" | "close" | "miss" | null;

interface PracticeCardProps {
  target: PracticeSign;
  outcome: PracticeOutcome;
  streak: number;
  bestStreak: number;
  matched: number;
  attempts: number;
  disabled: boolean;
  onNext: () => void;
}

export function formatSign(sign: string) {
  return sign.replace(/_/g, " ");
}

/** The sign to perform, with its demo clip and the visitor's score. */
export function PracticeCard({
  target,
  outcome,
  streak,
  bestStreak,
  matched,
  attempts,
  disabled,
  onNext,
}: PracticeCardProps) {
  return (
    <div className="mb-6 rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[0.08] to-rose-500/[0.06] p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <video
            key={target.index}
            src={`/videos/signs/${target.index}.mp4`}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={`Demo of the sign ${formatSign(target.name)}`}
          />
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/70">
            Demo
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-indigo-200/70">Your challenge</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={target.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="truncate text-2xl font-bold capitalize text-white"
            >
              {formatSign(target.name)}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 text-xs text-white/50">Watch the demo, then record yourself signing it.</p>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <FaRandom className="text-[10px]" /> {outcome === "match" ? "Next sign" : "Skip"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat
          icon={<FaFire className={cn(streak > 0 ? "text-orange-400" : "text-white/30")} />}
          label="Streak"
          value={streak}
          highlight={streak >= 3}
        />
        <Stat icon={<FaTrophy className="text-amber-300" />} label="Best" value={bestStreak} />
        <Stat label="Matched" value={`${matched}/${attempts}`} />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5 transition-colors",
        highlight ? "border-orange-400/30 bg-orange-500/10" : "border-white/5 bg-white/[0.03]"
      )}
    >
      <div className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums text-white">
        {icon}
        <motion.span key={String(value)} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
          {value}
        </motion.span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}
