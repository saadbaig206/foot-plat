"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BrainCircuit, LayoutDashboard, Menu, Settings, Shirt, Trophy, UserRound, Award, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Football Analytics", icon: BarChart3 },
  { href: "/predictions", label: "AI Predictions", icon: BrainCircuit },
  { href: "/rankings", label: "Rankings & Awards", icon: Award },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Shirt },
  { href: "/players", label: "Players", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-panel px-4 py-3 md:hidden">
        <span className="font-semibold">Pitchside<span className="text-pos">IQ</span></span>
        <button aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <nav aria-label="Main"
        className={`${open ? "block" : "hidden"} fixed inset-x-0 top-[49px] z-10 border-b border-line bg-panel p-3 md:static md:block md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r`}>
        <div className="mb-6 hidden px-3 pt-3 text-lg font-semibold md:block">Pitchside<span className="text-pos">IQ</span></div>
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={() => setOpen(false)} aria-current={active(href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active(href) ? "bg-panel2 text-ink" : "text-muted hover:bg-panel2/60 hover:text-ink"}`}>
                <Icon className={`h-4 w-4 ${active(href) ? "text-pos" : ""}`} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
