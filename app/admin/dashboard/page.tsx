// app/admin/dashboard/page.tsx
"use client"; // Required for using hooks like useAuth

import AuthProvider, { useAuth } from '@/lib/authContext'; // Adjust path
import Dashboard from '@/components/admin/Dashboard';   // Adjust path
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';

function DashboardPageContent() {
  const { currentUser, isAdmin, loading } = useAuth(); // Added isAdmin
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        console.log("Dashboard: No current user, redirecting to login.");
        router.push('/admin/login');
      } else if (!isAdmin) {
        console.log("Dashboard: User is not admin, redirecting to login.");
        // Or redirect to a specific 'access-denied' page if you create one
        router.push('/admin/login?error=access_denied');
      } else {
        console.log("Dashboard: Admin user confirmed.");
      }
    }
  }, [currentUser, isAdmin, loading, router]);

  if (loading) {
    return <p className="text-center mt-10">Loading user authentication...</p>;
  }

  // If not loading, and not an admin, or no user, this part should ideally not be reached due to redirects.
  // However, as a fallback or during brief state transitions:
  if (!currentUser || !isAdmin) {
    // This message might briefly appear before redirection, or if redirection fails.
    return <p className="text-center mt-10 text-red-500">Access Denied. You must be an admin to view this page.</p>;
  }

  // User is authenticated and is an admin
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={async () => {
            const auth = getAuth(app);
            await auth.signOut();
            router.push('/admin/login');
          }}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

export default function AdminDashboardPage() {
    return (
        <AuthProvider>
            <DashboardPageContent />
        </AuthProvider>
    )
}
