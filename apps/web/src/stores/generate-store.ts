import type { ThreadPost } from "@aff/types";
import { create } from "zustand";

interface GenerateState {
  post: ThreadPost | null;
  open: (post: ThreadPost) => void;
  close: () => void;
}

export const useGenerateStore = create<GenerateState>((set) => ({
  post: null,
  open: (post) => set({ post }),
  close: () => set({ post: null }),
}));
