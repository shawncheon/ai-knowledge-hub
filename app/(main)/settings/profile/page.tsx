"use client";

import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ProfilePage() {
  const { user, isLoading: isLoadingUser } = useUser();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const { error } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      alert("비밀번호가 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Password Update Error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "비밀번호 변경 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">MY ACCOUNT</div>
        <h1 className="text-3xl font-bold tracking-tight">비밀번호 변경</h1>
        <p className="mt-2 text-sm text-gray-500">
          로그인에 사용할 비밀번호를 변경할 수 있습니다.
        </p>
      </div>

      {/* 계정 정보 (조회 전용) */}

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 text-sm font-semibold">계정 정보</div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            이메일
          </label>
          <input
            type="text"
            value={user?.email || ""}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            이름
          </label>
          <input
            type="text"
            value={user?.name || ""}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            권한
          </label>
          <input
            type="text"
            value={user?.role === "admin" ? "관리자" : "임직원"}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 outline-none"
          />
        </div>

        <p className="mt-3 text-xs text-gray-400">
          이름/이메일 변경이 필요하면 관리자에게 문의해주세요.
        </p>
      </section>

      {/* 비밀번호 변경 */}

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 text-sm font-semibold">비밀번호 변경</div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            새 비밀번호
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6자 이상"
            disabled={isSavingPassword}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            새 비밀번호 확인
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="다시 한 번 입력"
            disabled={isSavingPassword}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={isSavingPassword}
            className="cursor-pointer rounded-lg bg-[#2452D9] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSavingPassword ? "변경 중..." : "저장"}
          </button>
        </div>
      </section>
    </>
  );
}
