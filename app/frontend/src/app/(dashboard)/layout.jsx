import AppShell from "@/components/app-shell/AppShell";
import AuthProvider from "@/components/auth/AuthProvider";

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
