"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookMarked, BookOpenCheck, CalendarDays, CalendarRange, DatabaseBackup, FileCheck2, GraduationCap, Languages, LibraryBig, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LearningRecordBridge } from "@/components/learning-records/LearningRecordBridge";
import { ReviewRecordBridge } from "@/components/review-engine/ReviewRecordBridge";
import { TechnicalEnglishRecordBridge } from "@/components/technical-english/TechnicalEnglishRecordBridge";
import { VisualLearningRecordBridge } from "@/components/visual-learning/VisualLearningRecordBridge";
import { CanonicalLearningHistoryBridge } from "@/components/learning-history/CanonicalLearningHistoryBridge";
import { RemoteSyncBridge } from "@/components/learning-history/RemoteSyncBridge";
import { RemoteModeBadge } from "@/components/learning-history/RemoteModeBadge";
import { DailyEnglishRecordBridge } from "@/components/daily-mission/DailyEnglishRecordBridge";

type NavItem = { href: string; label: string; icon: LucideIcon };
const navItems: NavItem[] = [
  { href: "/", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/learn", label: "Apprendre", icon: BookOpenCheck },
  { href: "/review", label: "Réviser", icon: RotateCcw },
  { href: "/subjects", label: "Matières", icon: LibraryBig },
  { href: "/semester", label: "Semestre", icon: CalendarRange },
  { href: "/sources", label: "Sources", icon: BookMarked },
  { href: "/notebooklm", label: "NotebookLM", icon: Sparkles },
  { href: "/evidence", label: "Preuves", icon: FileCheck2 },
  { href: "/progress", label: "Progression", icon: BarChart3 },
  { href: "/data", label: "Données", icon: DatabaseBackup },
];

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ pathname, horizontal = false }: { pathname: string; horizontal?: boolean }) {
  return (
    <nav aria-label="Navigation principale" className={cn(horizontal ? "flex min-w-max gap-1" : "space-y-1")}>
      {navItems.map((item) => {
        const selected = active(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={cn(
            "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2",
            selected ? "bg-emerald-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
          )}>
            <Icon className={cn("size-[1.125rem]", selected ? "text-emerald-300" : "text-slate-400 group-hover:text-slate-700")} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function pageLabel(pathname: string) {
  if (pathname.startsWith("/daily-english")) return "Daily English Mission";
  if (pathname.startsWith("/learn/excel-csv")) return "Fiche mission";
  return navItems.find((item) => active(pathname, item.href))?.label ?? "Engineer Learning OS";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-screen bg-[#f4f6f2] text-slate-950">
      <LearningRecordBridge />
      <DailyEnglishRecordBridge />
      <ReviewRecordBridge />
      <TechnicalEnglishRecordBridge />
      <VisualLearningRecordBridge />
      <CanonicalLearningHistoryBridge />
      <RemoteSyncBridge />
      <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2">Aller au contenu</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-200/80 bg-white px-4 py-5 md:flex md:flex-col lg:w-64 lg:px-5">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label="Engineer Learning OS — Aujourd’hui">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-950 text-emerald-200"><GraduationCap className="size-5" aria-hidden="true" /></span>
          <span><span className="block text-sm font-semibold">Engineer Learning</span><span className="block text-xs text-slate-500">Operating System</span></span>
        </Link>
        <div className="mt-8 flex-1">
          <p className="mb-3 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Espace de travail</p>
          <Navigation pathname={pathname} />
          <div className="my-5 border-t border-slate-200" />
          <Link href="/daily-english" aria-current={pathname.startsWith("/daily-english") ? "page" : undefined} className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
            pathname.startsWith("/daily-english") ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
          )}><Languages className="size-[1.125rem]" aria-hidden="true" />Daily English</Link>
        </div>
      </aside>

      <div className="md:pl-60 lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f4f6f2]/90 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-9">
            <div><p className="text-sm font-semibold">{pageLabel(pathname)}</p><p className="text-xs text-slate-500">Espace d’apprentissage local</p></div>
            <RemoteModeBadge />
          </div>
          <div className="overflow-x-auto border-t border-slate-200/70 px-3 py-2 md:hidden"><Navigation pathname={pathname} horizontal /></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-7 outline-none sm:px-6 sm:py-9 lg:px-9 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
