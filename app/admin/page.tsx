// app/admin/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthProvider, { useAuth } from '@/lib/authContext'; // Adjust path as per your structure

function AdminRootPage() {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser && isAdmin) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/admin/login');
      }
    }
  }, [currentUser, isAdmin, loading, router]);

  // Display a loading message or a blank screen while checking auth state
  // This content is usually not visible for long due to fast redirects
  return <p>Loading admin section...</p>;
}

export default function AdminPage() {
    return (
        <AuthProvider>
            <AdminRootPage />
        </AuthProvider>
    )
}
