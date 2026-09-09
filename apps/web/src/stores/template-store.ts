import type { Template } from "@aff/types";
import { create } from "zustand";

interface TemplateState {
  editorOpen: boolean;
  editingTemplate: Template | null;
  deleteTarget: Template | null;
  openEditor: (template: Template | null) => void;
  closeEditor: () => void;
  setDeleteTarget: (template: Template | null) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  editorOpen: false,
  editingTemplate: null,
  deleteTarget: null,
  openEditor: (template) =>
    set({ editorOpen: true, editingTemplate: template }),
  closeEditor: () => set({ editorOpen: false, editingTemplate: null }),
  setDeleteTarget: (template) => set({ deleteTarget: template }),
}));
