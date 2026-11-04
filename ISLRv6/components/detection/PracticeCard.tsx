import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FaExpand, FaFire, FaRandom, FaRedo, FaTrophy } from "react-icons/fa";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[0.08] to-rose-500/[0.06] p-4">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Watch the ${formatSign(target.name)} demo larger`}
          className="group relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
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
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
            <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white opacity-90 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <FaExpand className="text-[9px]" /> Enlarge
            </span>
          </span>
        </button>

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
          <p className="mt-1 text-xs text-white/50">Tap the demo to watch it larger, then record yourself.</p>
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

      <DemoDialog target={target} open={expanded} onOpenChange={setExpanded} />

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

const SPEEDS = [0.5, 0.75, 1] as const;

/** The demo clip, large, with slow motion so the hand shape is easy to follow. */
function DemoDialog({
  target,
  open,
  onOpenChange,
}: {
  target: PracticeSign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState<number>(0.75);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, open]);

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-[#0b0b10] p-4 text-white sm:p-6">
        <DialogTitle className="text-2xl">
          How to sign “<span className="capitalize">{formatSign(target.name)}</span>”
        </DialogTitle>
        <DialogDescription className="text-white/60">
          Watch the hand shape, where the hands are, and how they move. Slow it down if it is too fast.
        </DialogDescription>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            key={target.index}
            src={`/videos/signs/${target.index}.mp4`}
            className="max-h-[65vh] w-full object-contain"
            autoPlay
            loop
            muted
            playsInline
            controls
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = speed;
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-white/60">
            Speed
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  speed === value ? "bg-indigo-500 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {value === 1 ? "Normal" : `${value}x`}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              <FaRedo className="text-xs" /> Replay
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Got it, let me try
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
