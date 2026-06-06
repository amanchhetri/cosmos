import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

export function CountUp({ value, decimals = 0, suffix = "" }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const controls = animate(mv, value ?? 0, { duration: 0.8, ease: "easeOut" });
    return controls.stop;
  }, [value, mv]);
  return <motion.span className="font-mono tabular-nums">{text}</motion.span>;
}
