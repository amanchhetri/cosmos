import { motion } from "framer-motion";

/** Pill shown over the canvas in manual mode; click to resume auto-follow. */
export function ResumeFollowButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Resume auto-follow"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-space-2/80 px-3 py-1.5 font-mono text-xs text-instrument ring-1 ring-instrument/30 backdrop-blur transition-colors hover:bg-space-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-instrument"
    >
      <span aria-hidden="true">↻</span> Resume auto-follow
    </motion.button>
  );
}
