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

interface AuthState {
  user: User | null;
  permissions: string[];
  scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
  isResolved: boolean;
  error: string | null;
  clerkOrganizationId: string | null;
  setGrosAccess: (access: {
    user: User;
    permissions: string[];
    scopes: Array<{ type: "store" | "warehouse" | "city"; id: string; name: string }>;
    clerkOrganizationId?: string | null;
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
  clerkOrganizationId: null,
  setGrosAccess: ({ user, permissions, scopes, clerkOrganizationId }) =>
    set({
      user,
      permissions,
      scopes,
      clerkOrganizationId: clerkOrganizationId || null,
      isResolved: true,
      error: null,
    }),
  setError: (error) => set({ error, isResolved: false }),
  clearGrosAccess: () =>
    set({
      user: null,
      permissions: [],
      scopes: [],
      clerkOrganizationId: null,
      isResolved: false,
      error: null,
    }),
}));
