import * as React from "react";
import {
  Bell,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Inbox,
  LogOut,
  Mail,
  Newspaper,
  User,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { slug: "all", name: "All Inbox", icon: Inbox, color: "text-foreground" },
  { slug: "newsletters", name: "Newsletters", icon: Newspaper, color: "text-violet-500" },
  { slug: "job-recruitment", name: "Job / Recruitment", icon: Briefcase, color: "text-blue-500" },
  { slug: "finance", name: "Finance", icon: DollarSign, color: "text-emerald-500" },
  { slug: "notifications", name: "Notifications", icon: Bell, color: "text-amber-500" },
  { slug: "personal", name: "Personal", icon: User, color: "text-pink-500" },
  { slug: "work-professional", name: "Work", icon: Briefcase, color: "text-indigo-500" },
];

interface SidebarProps {
  activeCategory?: string;
  onCategoryChange?: (slug: string) => void;
}

export function Sidebar({ activeCategory = "all", onCategoryChange }: SidebarProps) {
  const { profile, signOut, connectGmail, disconnectGmail } = useAuth();
  const {
    sidebarOpen,
    sidebarCollapsed,
    isDesktop,
    closeSidebar,
    toggleSidebarCollapsed,
  } = useLayout();
  const drawerMode = !isDesktop;
  const [connecting, setConnecting] = React.useState(false);

  const handleGmailAction = async () => {
    setConnecting(true);
    try {
      if (profile?.gmail_connected) {
        await disconnectGmail();
      } else {
        await connectGmail();
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleCategoryChange = (slug: string) => {
    onCategoryChange?.(slug);
    if (drawerMode) closeSidebar();
  };

  const collapsed = isDesktop && sidebarCollapsed;

  return (
    <>
      {drawerMode && sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground panel-transition z-50 flex shrink-0 flex-col border-r",
          collapsed ? "w-[4.5rem]" : "w-64",
          drawerMode
            ? cn(
                "fixed inset-y-0 left-0 shadow-xl",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "relative",
        )}
        aria-label="Sidebar"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b px-2 py-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggleSidebarCollapsed}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b px-3 py-3">
            <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Gmail Intelligence</p>
              <p className="text-muted-foreground truncate text-xs">AI inbox assistant</p>
            </div>
            {drawerMode && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={closeSidebar}>
                <X className="size-4" />
              </Button>
            )}
            {isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={toggleSidebarCollapsed}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
          </div>
        )}

        <div className={cn("px-3 py-3", collapsed && "flex justify-center px-2")}>
          {profile?.gmail_connected ? (
            collapsed ? (
              <div
                className="bg-emerald-500 size-2.5 rounded-full"
                title="Gmail connected"
              />
            ) : (
              <Badge variant="success" className="w-full justify-center py-1">
                Gmail connected
              </Badge>
            )
          ) : (
            <Button
              className={cn("w-full", collapsed && "size-9 px-0")}
              size="sm"
              onClick={() => void handleGmailAction()}
              disabled={connecting}
              title={connecting ? "Connecting…" : "Connect Gmail"}
            >
              {collapsed ? (
                <Mail className="size-4" />
              ) : (
                connecting ? "Connecting…" : "Connect Gmail"
              )}
            </Button>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 overflow-y-auto py-2",
            collapsed ? "space-y-1 px-2" : "space-y-1 px-2",
          )}
          aria-label="Categories"
        >
          {CATEGORIES.map(({ slug, name, icon: Icon, color }) => (
            <button
              key={slug}
              type="button"
              onClick={() => handleCategoryChange(slug)}
              title={collapsed ? name : undefined}
              className={cn(
                "hover:bg-sidebar-accent flex items-center rounded-lg text-sm transition-colors",
                collapsed
                  ? "mx-auto size-9 justify-center"
                  : "w-full gap-2 px-3 py-2",
                activeCategory === slug && "bg-sidebar-accent font-medium",
              )}
            >
              <Icon className={cn("size-4 shrink-0", color)} aria-hidden="true" />
              {!collapsed && <span className="truncate">{name}</span>}
            </button>
          ))}
        </nav>

        <div className={cn("mt-auto border-t p-3", collapsed && "px-2")}>
          {!collapsed ? (
            <>
              <div className="mb-3 flex items-center gap-2 px-1">
                <Avatar
                  src={profile?.avatar_url}
                  alt={profile?.display_name ?? profile?.email ?? "User"}
                  fallback={profile?.display_name ?? profile?.email ?? "U"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {profile?.display_name ?? "User"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {profile?.email}
                  </p>
                </div>
                <ThemeToggle />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Avatar
                src={profile?.avatar_url}
                alt={profile?.display_name ?? profile?.email ?? "User"}
                fallback={profile?.display_name?.[0] ?? profile?.email?.[0] ?? "U"}
                className="size-8"
              />
              <ThemeToggle />
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => void signOut()}
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
