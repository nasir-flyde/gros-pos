import { createContext, useContext } from "react";

export interface AuthAccessContextValue {
  refreshAccess: () => Promise<void>;
}

export const AuthAccessContext = createContext<AuthAccessContextValue | null>(null);

export function useAuthAccess(): AuthAccessContextValue {
  const value = useContext(AuthAccessContext);
  if (!value) throw new Error("useAuthAccess must be used within AuthProvider");
  return value;
}
