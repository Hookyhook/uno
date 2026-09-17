import { create } from "zustand";
import type { RoomView, Session } from "../protocol";

interface State {
  session: Session | null;
  view: RoomView | null;
  error: string | null;
  offline: boolean;
  setSession: (session: Session | null) => void;
  setView: (view: RoomView) => void;
  setError: (error: string | null) => void;
  setOffline: (offline: boolean) => void;
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  session: null,
  view: null,
  error: null,
  offline: false,
  setSession: (session) => set({ session }),
  setView: (view) => set((s) => (s.view && s.view.version > view.version ? {} : { view, offline: false })),
  setError: (error) => set({ error }),
  setOffline: (offline) => set({ offline }),
  reset: () => set({ session: null, view: null, error: null, offline: false }),
}));
