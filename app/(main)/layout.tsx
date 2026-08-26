"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { UserProvider, useUser } from "@/context/UserContext";

function getActiveLabel(pathname: string) {
  if (pathname.startsWith("/documents")) return "정보 관리";
  if (pathname.startsWith("/history")) return "질문 기록";
  if (pathname.startsWith("/settings/users")) return "임직원 관리";
  if (pathname.startsWith("/settings/profile")) return "비밀번호 변경";
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
    <main className="min-h-screen bg-[#F4F6FA] text-[#1A2233]">
      <div className="flex min-h-screen">
        {/* =====================================
            SIDEBAR
        ====================================== */}

        <aside className="fixed left-0 top-0 flex h-screen w-[248px] flex-col bg-[#101B33]">
          {/* Logo */}

          <Link
            href={user?.role === "admin" ? "/dashboard" : "/"}
            className="flex h-[72px] cursor-pointer items-center border-b border-white/10 px-6 text-left transition hover:bg-white/5"
          >
            <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#2452D9] text-sm font-bold text-white">
              AI
            </div>

            <div>
              <div className="text-[14px] font-bold text-white">
                사내 정보 센터
              </div>

              <div className="text-[10px] text-white/40">
                AI Knowledge Management
              </div>
            </div>
          </Link>

          {/* Navigation */}

          <nav className="flex-1 px-3 py-6">
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
              Workspace
            </div>

            {/* Dashboard (관리자 전용) */}

            {user?.role === "admin" && (
              <Link
                href="/dashboard"
                className={`mb-0.5 flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive("/dashboard")
                    ? "bg-[#2452D9] font-semibold text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="mr-3 text-base">▦</span>
                대시보드
              </Link>
            )}

            {/* AI Search */}

            <Link
              href="/"
              className={`mb-0.5 flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition ${
                isActive("/")
                  ? "bg-[#2452D9] font-semibold text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="mr-3 text-base">⌕</span>
              AI 정보 검색
            </Link>

            {/* History */}

            <Link
              href="/history"
              className={`mb-0.5 flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition ${
                isActive("/history")
                  ? "bg-[#2452D9] font-semibold text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="mr-3 text-base">◷</span>
              질문 기록
            </Link>

            {/* Documents (관리자 전용) */}

            {user?.role === "admin" && (
              <Link
                href="/documents"
                className={`mb-0.5 flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive("/documents")
                    ? "bg-[#2452D9] font-semibold text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="mr-3 text-base">□</span>
                정보 관리
              </Link>
            )}

            <div className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
              System
            </div>

            {user?.role === "admin" ? (
              <>
                <div className="mb-1 px-3 py-1.5 text-[11px] font-medium text-white/30">
                  계정관리
                </div>

                <Link
                  href="/settings/users"
                  className={`mb-0.5 flex w-full items-center rounded-lg py-2.5 pl-6 pr-3 text-sm transition ${
                    isActive("/settings/users")
                      ? "bg-[#2452D9] font-semibold text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="mr-3 text-base">👥</span>
                  임직원 관리
                </Link>

                <Link
                  href="/settings/profile"
                  className={`mb-0.5 flex w-full items-center rounded-lg py-2.5 pl-6 pr-3 text-sm transition ${
                    isActive("/settings/profile")
                      ? "bg-[#2452D9] font-semibold text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="mr-3 text-base">⚙</span>
                  비밀번호 변경
                </Link>
              </>
            ) : (
              <Link
                href="/settings/profile"
                className={`mb-0.5 flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive("/settings/profile")
                    ? "bg-[#2452D9] font-semibold text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="mr-3 text-base">⚙</span>
                비밀번호 변경
              </Link>
            )}
          </nav>

          {/* User */}

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center rounded-lg bg-white/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#101B33] text-xs font-bold text-white">
                {user?.name?.[0] || "?"}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {user?.name || "사용자"}
                </div>

                <div className="truncate text-xs text-white/40">
                  {user?.role === "admin" ? "관리자" : "임직원"}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="ml-2 shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white"
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

        <section className="ml-[248px] min-h-screen flex-1">
          {/* Header */}

          <header className="flex h-[72px] items-center justify-between border-b border-[#E2E6EF] bg-white px-8">
            <div>
              <div className="text-sm font-semibold text-[#1A2233]">
                {getActiveLabel(pathname)}
              </div>

              <div className="text-xs text-[#8891A5]">
                AI Knowledge Management
              </div>
            </div>

            <div className="flex items-center gap-5">
              <button className="text-lg text-[#8891A5]">♢</button>

              <div className="h-7 w-px bg-[#E2E6EF]" />

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2452D9] text-xs font-bold text-white">
                  {user?.name?.[0] || "?"}
                </div>

                <span className="text-sm font-medium text-[#1A2233]">
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
