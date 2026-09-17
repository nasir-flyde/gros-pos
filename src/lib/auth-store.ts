import { create } from "zustand";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isSuperAdmin: boolean;
  organizationId?: string | null;
  mustChangePassword?: boolean;
}

export type AuthStatus = "unresolved" | "loading" | "ready" | "error";
export type AuthFailureCode = "NO_LOCAL_ACCOUNT" | "ACCESS_UNAVAILABLE";

export interface AuthFailure {
  code: AuthFailureCode;
  message: string;
}

interface AuthState {
  user: User | null;
  permissions: string[];
  scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
  status: AuthStatus;
  error: AuthFailure | null;
  clerkOrganizationId: string | null;
  setLoading: () => void;
  setGrosAccess: (access: {
    user: User;
    permissions: string[];
    scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
    clerkOrganizationId?: string | null;
  }) => void;
  setError: (error: AuthFailure) => void;
  clearGrosAccess: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  permissions: [],
  scopes: [],
  status: "unresolved",
  error: null,
  clerkOrganizationId: null,
  setLoading: () => set({ status: "loading", error: null }),
  setGrosAccess: ({ user, permissions, scopes, clerkOrganizationId }) =>
    set({
      user,
      permissions,
      scopes,
      clerkOrganizationId: clerkOrganizationId || null,
      status: "ready",
      error: null,
    }),
  setError: (error) => set({ error, status: "error" }),
  clearGrosAccess: () =>
    set({
      user: null,
      permissions: [],
      scopes: [],
      clerkOrganizationId: null,
      status: "unresolved",
      error: null,
    }),
}));
