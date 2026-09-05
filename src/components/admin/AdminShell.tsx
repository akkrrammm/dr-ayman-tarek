"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { ChevronDown, Menu, X, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_NAV, isNavGroup, type AdminNavItem, type AdminNavGroup, type AdminNavLeaf } from "./navConfig";
import type { AdminProfile } from "@/server/auth";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { QueryProvider } from "./QueryProvider";

/**
 * Forces the dashboard to English/LTR regardless of whatever the public
 * site's language switch last set on <html> — the admin is a single-language
 * tool, and without this a client-side nav from an Arabic-flipped public
 * page would carry the stale dir="rtl"/lang="ar" attributes over.
 */
function useForceLtr() {
  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.dir;
    const prevLang = html.lang;
    html.dir = "ltr";
    html.lang = "en";
    return () => {
      html.dir = prevDir;
      html.lang = prevLang;
    };
  }, []);
}

function NavGroupLink({ item, onNavigate }: { item: AdminNavGroup; onNavigate: () => void }) {
  const pathname = usePathname();
  const groupActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
  const [open, setOpen] = useState(groupActive);
  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
          groupActive ? "text-white" : "text-on-surface-variant hover:text-white",
        )}
      >
        <span className="flex items-center gap-3">
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-outline-variant/25 pl-4">
              {item.children.map((child) => {
                const active = pathname === child.href || pathname.startsWith(child.href + "/");
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavLeafLink({ item, onNavigate }: { item: AdminNavLeaf; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        active ? "text-white" : "text-on-surface-variant hover:text-white",
      )}
    >
      {active && (
        <motion.span layoutId="admin-nav-active" className="absolute inset-0 rounded-xl bg-primary/15" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
      )}
      <item.icon className="relative z-10 h-[18px] w-[18px]" />
      <span className="relative z-10">{item.label}</span>
    </Link>
  );
}

function NavLink({ item, onNavigate }: { item: AdminNavItem; onNavigate: () => void }) {
  if (isNavGroup(item)) return <NavGroupLink item={item} onNavigate={onNavigate} />;
  return <NavLeafLink item={item} onNavigate={onNavigate} />;
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <Link href="/admin" onClick={onNavigate} className="flex items-center gap-3 px-2 pb-8 pt-2">
        <div className="icon-badge-neon flex h-10 w-10 items-center justify-center rounded-xl">
          <span className="material-symbols-outlined icon-neon text-xl">neurology</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Dr. Ayman Tarek</p>
          <p className="text-xs text-on-surface-variant">Admin Dashboard</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {ADMIN_NAV.map((item) => (
          <NavLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  );
}

export function AdminShell({ profile, children }: { profile: AdminProfile; children: React.ReactNode }) {
  useForceLtr();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  return (
    <QueryProvider>
    <ConfirmProvider>
    <Toaster theme="dark" position="top-center" richColors />
    <div dir="ltr" className="min-h-screen bg-background text-on-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_900px_600px_at_15%_0%,rgba(196,61,255,0.1),transparent_60%),radial-gradient(ellipse_700px_500px_at_100%_20%,rgba(255,79,163,0.06),transparent_55%)]"
      />

      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col overflow-y-auto rounded-none border-y-0 border-l-0 px-4 py-4 lg:flex">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="glass fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-y-auto rounded-none border-y-0 border-l-0 px-4 py-4 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[260px]">
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-4 rounded-none border-x-0 border-t-0 px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full rounded-full border border-outline-variant/30 bg-surface-container py-2 pl-10 pr-4 text-sm text-white outline-none placeholder-on-surface-variant/50 focus:border-primary/50"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{profile.full_name || profile.email}</p>
              <p className="text-xs capitalize text-on-surface-variant">{profile.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
              {initials}
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </ConfirmProvider>
    </QueryProvider>
  );
}
