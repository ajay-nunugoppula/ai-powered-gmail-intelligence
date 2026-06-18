import * as React from "react";
import {
  Bell,
  Briefcase,
  DollarSign,
  Inbox,
  LogOut,
  Mail,
  Newspaper,
  User,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
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

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex w-64 shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
          <Mail className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Gmail Intelligence</p>
          <p className="text-muted-foreground truncate text-xs">AI inbox assistant</p>
        </div>
      </div>

      <div className="px-3 py-3">
        {profile?.gmail_connected ? (
          <Badge variant="success" className="w-full justify-center py-1">
            Gmail connected
          </Badge>
        ) : (
          <Button
            className="w-full"
            size="sm"
            onClick={() => void handleGmailAction()}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect Gmail"}
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2" aria-label="Categories">
        {CATEGORIES.map(({ slug, name, icon: Icon, color }) => (
          <button
            key={slug}
            type="button"
            onClick={() => onCategoryChange?.(slug)}
            className={cn(
              "hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
              activeCategory === slug && "bg-sidebar-accent font-medium",
            )}
          >
            <Icon className={cn("size-4 shrink-0", color)} aria-hidden="true" />
            <span className="truncate">{name}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t p-3">
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
            <p className="text-muted-foreground truncate text-xs">{profile?.email}</p>
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
      </div>
    </aside>
  );
}
