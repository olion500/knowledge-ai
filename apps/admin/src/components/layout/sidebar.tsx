"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Cog,
  FileText,
  LayoutDashboard,
  Link2,
  Users,
} from "lucide-react";

const navigation = [
  {
    name: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "통합 관리",
    href: "/integrations",
    icon: Link2,
  },
  {
    name: "문서 관리",
    href: "/documents",
    icon: FileText,
  },
  {
    name: "모니터링",
    href: "/monitoring",
    icon: BarChart3,
  },
  {
    name: "사용자 관리",
    href: "/users",
    icon: Users,
  },
  {
    name: "설정",
    href: "/settings",
    icon: Cog,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-xl font-bold">Knowledge AI</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
} 