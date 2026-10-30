"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Award,
  BarChart3,
  BrainCircuit,
  Database,
  LayoutDashboard,
  Menu,
  Settings,
  Shirt,
  Sparkles,
  Trophy,
  UserRound,
  X,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Football Analytics", icon: BarChart3 },
  { href: "/predictions", label: "AI Predictions", icon: BrainCircuit },
  { href: "/rankings", label: "Rankings & Awards", icon: Award },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/teams", label: "Clubs & Teams", icon: Shirt },
  { href: "/players", label: "Players", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-panel/95 backdrop-blur-md px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pos font-black text-bg text-sm shadow-xs">
            P
          </div>
          <span className="font-bold text-base tracking-tight text-ink">
            Pitchside<span className="text-pos">IQ</span>
          </span>
        </Link>
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-lg p-1.5 text-muted hover:bg-panel2 hover:text-ink transition-colors"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Desktop / Expanded Mobile Sidebar */}
      <nav
        aria-label="Main"
        className={`${
          open ? "block" : "hidden"
        } fixed inset-x-0 top-[49px] z-10 border-b border-line bg-panel p-4 md:static md:block md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r md:p-5 flex flex-col justify-between`}
      >
        <div>
          {/* Brand Logo Header */}
          <div className="mb-8 hidden md:flex items-center gap-2.5 px-2 pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pos to-emerald-600 font-black text-bg shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="font-black text-lg tracking-tight text-ink leading-none">
                Pitchside<span className="text-pos">IQ</span>
              </div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">
                Football Intelligence
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <ul className="space-y-1.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const isActive = active(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-pos/15 text-pos font-semibold shadow-xs"
                        : "text-muted hover:bg-panel2 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 transition-colors ${
                          isActive ? "text-pos" : "text-muted group-hover:text-ink"
                        }`}
                        aria-hidden
                      />
                      <span>{label}</span>
                    </div>
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-pos" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Database Status Footer Card */}
        <div className="mt-8 pt-4 border-t border-line/60">
          <div className="rounded-xl border border-line/60 bg-panel2/50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-ink">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-pos" />
                Neon DB Live
              </span>
              <span className="flex h-2 w-2 rounded-full bg-pos animate-pulse" />
            </div>
            <p className="mt-1 text-[11px] text-muted leading-tight">
              In-place upserts active. 380+ matches synced.
            </p>
          </div>
        </div>
      </nav>
    </>
  );
}
