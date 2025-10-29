import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, country: string, currency: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for guest mode first
      const guestMode = localStorage.getItem("guestMode");
      if (guestMode === "true") {
        const guestUser: User = {
          id: "guest-user",
          email: "guest@example.com",
          name: "Guest User",
          country: "US",
          region: null,
          currency: "USD",
          createdAt: new Date(),
        };
        setUser(guestUser);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const userData = await response.json();
    setUser(userData);
  };

  const signup = async (email: string, password: string, fullName: string, country: string, currency: string) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, country, currency }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Signup failed");
    }

    const userData = await response.json();
    setUser(userData);
  };

  const continueAsGuest = async () => {
    localStorage.setItem("guestMode", "true");
    const guestUser: User = {
      id: "guest-user",
      email: "guest@example.com",
      name: "Guest User",
      country: "US",
      region: null,
      currency: "USD",
      createdAt: new Date(),
    };
    setUser(guestUser);
  };

  const logout = async () => {
    localStorage.removeItem("guestMode");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, continueAsGuest, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
