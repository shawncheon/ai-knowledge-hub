"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: loginError } =
        await supabaseBrowser.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      }

      const meResponse = await fetch("/api/me");
      const meData = await meResponse.json();

      const destination =
        meResponse.ok && meData.success && meData.user?.role === "admin"
          ? "/dashboard"
          : "/";

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#E2E6EF] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2452D9] text-sm font-bold text-white">
            AI
          </div>
          <h1 className="text-lg font-bold text-[#1A2233]">사내 정보 센터</h1>
          <p className="mt-1 text-xs text-[#8891A5]">AI Knowledge Management</p>
        </div>

        <div className="mb-6 rounded-lg bg-blue-50 p-4 text-center">
          <div className="text-xs font-semibold text-[#2452D9]">
            테스트 계정
          </div>
          <div className="mt-1.5 text-xs text-gray-600">
            이메일: test01@company.com
          </div>
          <div className="text-xs text-gray-600">비밀번호: test1234</div>
          <div className="mt-2 text-[11px] text-gray-400">
            동시 접속이 많으면 답변이 느릴 수 있습니다.
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#4B5468]">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full rounded-lg border border-[#E2E6EF] px-3 py-2.5 text-sm outline-none focus:border-[#2452D9]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#4B5468]">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#E2E6EF] px-3 py-2.5 text-sm outline-none focus:border-[#2452D9]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full cursor-pointer rounded-lg bg-[#2452D9] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
