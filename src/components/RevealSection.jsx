import { motion } from "framer-motion";

// Reusable scroll-reveal wrapper for dashboard sections. Reveals once on enter;
// reduced-motion users get the content immediately (no transform).
export function RevealSection({ children, className = "" }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
