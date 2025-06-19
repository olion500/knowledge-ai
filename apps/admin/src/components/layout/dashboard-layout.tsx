"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Toaster } from "sonner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto py-8">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
} 