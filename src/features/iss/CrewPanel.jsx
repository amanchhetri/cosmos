import { motion } from "framer-motion";

export function CrewPanel({ crew }) {
  const names = crew ?? [];
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Aboard the ISS — {names.length}
      </div>
      <ul className="mt-2 space-y-1">
        {names.map((name, i) => (
          <motion.li
            key={`${name}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="text-sm text-gray-200"
          >
            {name}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
