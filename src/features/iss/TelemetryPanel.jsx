import { motion } from "framer-motion";
import { CountUp } from "./CountUp";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function Stat({ label, value, decimals, suffix }) {
  return (
    <motion.div variants={item} className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1 text-2xl text-instrument">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
    </motion.div>
  );
}

export function TelemetryPanel({ iss }) {
  if (!iss) return null;
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
    >
      <Stat label="Altitude" value={iss.altitude} decimals={1} suffix=" km" />
      <Stat label="Velocity" value={iss.velocity} decimals={0} suffix=" km/h" />
      <Stat label="Latitude" value={iss.latitude} decimals={2} suffix="°" />
      <Stat label="Longitude" value={iss.longitude} decimals={2} suffix="°" />
    </motion.div>
  );
}
