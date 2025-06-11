// lib/authContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Added imports
import { app, db } from './firebase'; // Added db import

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true); // Initialize loading to true
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // User is signed in, check if they are an admin
        const adminRef = doc(db, "admins", user.uid);
        try {
          const adminDoc = await getDoc(adminRef);
          if (adminDoc.exists()) {
            setIsAdmin(true);
            console.log("User is admin:", user.uid);
          } else {
            setIsAdmin(false);
            console.log("User is not an admin:", user.uid);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        // No user signed in
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const value = {
    currentUser,
    loading,
    isAdmin,
  };

  // Render children only when not loading to prevent flash of unauthenticated content
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
