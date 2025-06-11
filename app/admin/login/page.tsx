// app/admin/login/page.tsx
import LoginForm from '@/components/auth/LoginForm'; // Adjust path if your components folder is different
import AuthProvider from '@/lib/authContext'; // Adjust path

export default function AdminLoginPage() {
  return (
    <AuthProvider>
      <div className="flex flex-col items-center justify-center min-h-screen py-2">
        <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
          <h1 className="text-4xl font-bold mb-8">Admin Login</h1>
          <LoginForm />
        </main>
      </div>
    </AuthProvider>
  );
}
