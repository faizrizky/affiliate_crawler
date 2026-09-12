import type { Variants } from "framer-motion";

export const overlayMotion: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.12 } },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

export const dialogMotion: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.14, ease: "easeIn" },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export const sheetMotion: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};
