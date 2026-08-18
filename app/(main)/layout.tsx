"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { UserProvider, useUser } from "@/context/UserContext";

const menuLabels: Record<string, string> = {
  "/dashboard": "대시보드",
  "/": "AI 정보 검색",
  "/documents": "정보 관리",
  "/history": "질문 기록",
  "/settings": "Settings",
};

function getActiveLabel(pathname: string) {
  if (pathname.startsWith("/documents")) return "정보 관리";
  if (pathname.startsWith("/history")) return "질문 기록";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "대시보드";
  return "AI 정보 검색";
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-gray-900">
      <div className="flex min-h-screen">
        {/* =====================================
            SIDEBAR
        ====================================== */}

        <aside className="fixed left-0 top-0 flex h-screen w-[240px] flex-col border-r border-gray-200 bg-white">
          {/* Logo */}

          <Link
            href={user?.role === "admin" ? "/dashboard" : "/"}
            className="flex h-[76px] cursor-pointer items-center border-b border-gray-100 px-6 text-left transition hover:bg-gray-50"
          >
            <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              AI
            </div>

            <div>
              <div className="text-[15px] font-bold">사내 정보 센터</div>

              <div className="text-[11px] text-gray-400">
                AI Knowledge Management
              </div>
            </div>
          </Link>

          {/* Navigation */}

          <nav className="flex-1 px-4 py-6">
            <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Workspace
            </div>

            {/* Dashboard (관리자 전용) */}

            {user?.role === "admin" && (
              <Link
                href="/dashboard"
                className={`mb-1 flex w-full items-center rounded-lg px-3 py-3 text-sm transition ${
                  isActive("/dashboard")
                    ? "bg-black font-semibold text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="mr-3 text-base">▦</span>
                대시보드
              </Link>
            )}

            {/* AI Search */}

            <Link
              href="/"
              className={`mb-1 flex w-full items-center rounded-lg px-3 py-3 text-sm transition ${
                isActive("/")
                  ? "bg-black font-semibold text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="mr-3 text-base">⌕</span>
              AI 정보 검색
            </Link>

{/* History */}

            <Link
              href="/history"
              className={`mb-1 flex w-full items-center rounded-lg px-3 py-3 text-sm transition ${
                isActive("/history")
                  ? "bg-black font-semibold text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="mr-3 text-base">◷</span>
              질문 기록
            </Link>

            {/* Documents (관리자 전용) */}

            {user?.role === "admin" && (
              <Link
                href="/documents"
                className={`mb-1 flex w-full items-center rounded-lg px-3 py-3 text-sm transition ${
                  isActive("/documents")
                    ? "bg-black font-semibold text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="mr-3 text-base">□</span>
                정보 관리
              </Link>
            )}

            <div className="mb-3 mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              System
            </div>

            {/* Settings */}

            <Link
              href="/settings"
              className={`mb-1 flex w-full items-center rounded-lg px-3 py-3 text-sm transition ${
                isActive("/settings")
                  ? "bg-gray-100 font-semibold text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="mr-3 text-base">⚙</span>
              Settings
            </Link>
          </nav>

          {/* User */}

          <div className="border-t border-gray-100 p-4">
            <div className="flex items-center rounded-xl bg-gray-50 p-3">
              <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
                {user?.name?.[0] || "?"}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {user?.name || "사용자"}
                </div>

                <div className="truncate text-xs text-gray-400">
                  {user?.role === "admin" ? "관리자" : "임직원"}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="ml-2 shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="로그아웃"
              >
                ⏻
              </button>
            </div>
          </div>
        </aside>

        {/* =====================================
            MAIN
        ====================================== */}

        <section className="ml-[240px] min-h-screen flex-1">
          {/* Header */}

          <header className="flex h-[76px] items-center justify-between border-b border-gray-200 bg-white px-8">
            <div>
              <div className="text-sm font-semibold">
                {getActiveLabel(pathname)}
              </div>

              <div className="text-xs text-gray-400">
                AI Knowledge Management
              </div>
            </div>

            <div className="flex items-center gap-5">
              <button className="text-lg text-gray-500">♢</button>

              <div className="h-7 w-px bg-gray-200" />

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white">
                  {user?.name?.[0] || "?"}
                </div>

                <span className="text-sm font-medium">
                  {user?.name || "사용자"}
                </span>
              </div>
            </div>
          </header>

          {/* =====================================
              CONTENT
          ====================================== */}

          <div className="mx-auto max-w-[1200px] px-8 py-10">{children}</div>
        </section>
      </div>
    </main>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
