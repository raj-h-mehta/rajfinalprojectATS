import { create } from "zustand";

export const useATSStore = create((set, get) => ({
  jobs: [],
  candidates: [],
  atsRuns: [],

  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),

  addCandidate: (candidate) =>
    set((state) => ({ candidates: [...state.candidates, candidate] })),

  addATSRun: (run) => set((state) => ({ atsRuns: [...state.atsRuns, run] })),

  updateATSRun: (id, updates) =>
    set((state) => ({
      atsRuns: state.atsRuns.map((run) =>
        run.id === id ? { ...run, ...updates } : run
      ),
    })),

  getJob: (id) => get().jobs.find((job) => job.id === id),
  getCandidate: (id) => get().candidates.find((c) => c.id === id),
  getATSRun: (id) => get().atsRuns.find((r) => r.id === id),
}));
