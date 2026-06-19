import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useBreakpoint } from "@/hooks/useMediaQuery";

const SIDEBAR_COLLAPSED_KEY = "gi-sidebar-collapsed";
const CHAT_OPEN_KEY = "gi-chat-open";

type MobileView = "threads" | "email";

interface LayoutContextValue {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  chatOpen: boolean;
  mobileView: MobileView;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  showMobileEmail: () => void;
  showMobileThreads: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { isMobile, isTablet, isDesktop, isWide } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [chatOpen, setChatOpen] = useState(() => {
    const stored = localStorage.getItem(CHAT_OPEN_KEY);
    return stored ? stored === "true" : true;
  });
  const [mobileView, setMobileView] = useState<MobileView>("threads");

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (isWide) {
      localStorage.setItem(CHAT_OPEN_KEY, String(chatOpen));
    }
  }, [chatOpen, isWide]);

  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (isWide && !localStorage.getItem(CHAT_OPEN_KEY)) {
      setChatOpen(true);
    }
  }, [isWide]);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => !collapsed);
  }, []);

  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleChat = useCallback(() => setChatOpen((open) => !open), []);

  const showMobileEmail = useCallback(() => setMobileView("email"), []);
  const showMobileThreads = useCallback(() => setMobileView("threads"), []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      sidebarCollapsed,
      chatOpen,
      mobileView,
      isMobile,
      isTablet,
      isDesktop,
      isWide,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      toggleSidebarCollapsed,
      openChat,
      closeChat,
      toggleChat,
      showMobileEmail,
      showMobileThreads,
    }),
    [
      sidebarOpen,
      sidebarCollapsed,
      chatOpen,
      mobileView,
      isMobile,
      isTablet,
      isDesktop,
      isWide,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      toggleSidebarCollapsed,
      openChat,
      closeChat,
      toggleChat,
      showMobileEmail,
      showMobileThreads,
    ],
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within LayoutProvider");
  }
  return context;
}
