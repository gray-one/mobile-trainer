import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider, firebaseConfig } from "../firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<string | null>;
  logout: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      return null;
    } catch (err: any) {
      // If configuration missing, log helpful diagnostic info to console
      const code = err?.code ?? err?.message ?? "";
      if (
        String(code).toLowerCase().includes("configuration") ||
        String(code).toLowerCase().includes("auth/configuration-not-found")
      ) {
        // eslint-disable-next-line no-console
        console.error(
          "Firebase Auth CONFIGURATION_NOT_FOUND. Current firebase config:",
          {
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId,
            appId: firebaseConfig.appId,
          }
        );
        return "Konfiguracja Firebase nie znaleziona (CONFIGURATION_NOT_FOUND). Sprawdź `VITE_FIREBASE_AUTH_DOMAIN`, czy Google Sign-In jest włączony i czy Authorized domains zawiera Twoją domenę (np. localhost:5173).";
      }
      return err?.message ?? "Błąd logowania";
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return null;
    } catch (err: any) {
      return err?.message ?? "Błąd podczas wylogowywania";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
