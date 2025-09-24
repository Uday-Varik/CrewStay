import { NavigationBar } from "@/components/ui/navigation-bar";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  
  // Don't show navigation on auth page or when user is not loaded
  if (!user) {
    return <>{children}</>;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationBar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}