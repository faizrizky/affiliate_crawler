import { create } from "zustand";

interface SearchState {
  lastKeyword: string | null;
  setLastKeyword: (keyword: string | null) => void;
  activeTopicId: string | null;
  setActiveTopic: (topicId: string | null) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  lastKeyword: null,
  setLastKeyword: (keyword) => set({ lastKeyword: keyword }),
  activeTopicId: null,
  setActiveTopic: (topicId) => set({ activeTopicId: topicId }),
}));
