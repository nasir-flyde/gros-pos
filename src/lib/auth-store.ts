import { create } from "zustand";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isSuperAdmin: boolean;
  organizationId?: string | null;
}

interface AuthState {
  user: User | null;
  permissions: string[];
  scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
  isResolved: boolean;
  error: string | null;
  setGrosAccess: (access: {
    user: User;
    permissions: string[];
    scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
  }) => void;
  setError: (error: string | null) => void;
  clearGrosAccess: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  permissions: [],
  scopes: [],
  isResolved: false,
  error: null,
  setGrosAccess: ({ user, permissions, scopes }) =>
    set({ user, permissions, scopes, isResolved: true, error: null }),
  setError: (error) => set({ error, isResolved: false }),
  clearGrosAccess: () =>
    set({ user: null, permissions: [], scopes: [], isResolved: false, error: null }),
}));
