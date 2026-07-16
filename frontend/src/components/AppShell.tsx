/**
 * AppShell
 *
 * Persistent layout wrapper for all BrainX routes.
 *
 * Desktop: 240px fixed left sidebar + scrollable content area.
 * Mobile (<768px): sidebar collapses — top bar with hamburger toggle.
 *
 * Props: none (reads route via react-router NavLink)
 *
 * Design tokens used:
 *   --sidebar, --sidebar-foreground, --sidebar-border, --sidebar-accent,
 *   --color-brand, --primary, --primary-foreground, --font-mono,
 *   --border, --background, --foreground
 */

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Menu, X, Zap } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
  { label: "Personas", href: "/personas", icon: Users, end: false },
] as const;

function BrainXLogo() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: "var(--color-brand)" }}
      >
        <Zap className="h-4 w-4" style={{ color: "var(--color-near-black)" }} />
      </span>
      <span
        className="text-base font-semibold tracking-tight"
        style={{ color: "var(--foreground)", letterSpacing: "-0.2px" }}
      >
        BrainX
      </span>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();

  const handleNewAnalysis = () => {
    onNavigate?.();
    navigate("/analysis/new");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className="flex h-16 items-center px-5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <BrainXLogo />
      </div>

      {/* New Analysis CTA */}
      <div className="px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={handleNewAnalysis}
          className="w-full rounded-full px-5 py-2 text-sm font-medium transition"
          style={{
            background: "var(--color-brand)",
            color: "var(--color-near-black)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          New Analysis
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, end }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "text-foreground"
                      : "hover:text-foreground",
                  ].join(" ")
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                  background: isActive ? "var(--sidebar-accent)" : "transparent",
                })}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom spacer — theme toggle placeholder */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", letterSpacing: "0.6px" }}
          >
            BrainX v0.1
          </p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside
        className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30"
        style={{
          background: "var(--sidebar)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
        aria-label="Sidebar"
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 w-full h-full cursor-default"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div
            className="relative z-50 h-full w-72 shadow-xl"
            style={{ background: "var(--sidebar)" }}
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full transition"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Mobile Top Bar ─────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-4 md:hidden"
        style={{
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <BrainXLogo />
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition"
          style={{ color: "var(--foreground)" }}
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-60 min-h-screen"
        style={{ background: "var(--background)" }}
      >
        {/* Mobile top-bar spacer */}
        <div className="h-14 md:hidden" aria-hidden="true" />
        {children}
      </main>
    </div>
  );
}
