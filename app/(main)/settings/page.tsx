"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export default function SettingsPage() {
  const { user } = useUser();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "employee">("employee");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();

      if (response.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("임직원 목록 조회 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user]);

  const resetForm = () => {
    setNewEmail("");
    setNewName("");
    setNewRole("employee");
    setNewPassword("");
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newName.trim() || !newPassword.trim()) {
      alert("이메일, 이름, 초기 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (newPassword.length < 6) {
      alert("초기 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          role: newRole,
          password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "계정 생성에 실패했습니다.");
      }

      alert(`계정이 생성되었습니다.\n\n이메일: ${newEmail.trim()}`);
      resetForm();
      setIsFormOpen(false);
      await loadUsers();
    } catch (error) {
      console.error("Create User Error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "계정 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    // 본인 계정 권한을 낮추려는 시도는 요청 자체를 보내지 않고 즉시 안내
    if (id === user?.id && role !== "admin") {
      alert("본인 계정의 권한은 스스로 낮출 수 없습니다.");
      await loadUsers();
      return;
    }

    setUpdatingId(id);

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error || "권한 변경에 실패했습니다.");
        await loadUsers();
        return;
      }

      await loadUsers();
    } catch (error) {
      console.error("Role Change Error:", error);
      alert("권한 변경 중 오류가 발생했습니다.");
      await loadUsers();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `"${name}" 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) return;

    setDeletingId(id);

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "계정 삭제에 실패했습니다.");
      }

      await loadUsers();
    } catch (error) {
      console.error("Delete User Error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "계정 삭제 중 오류가 발생했습니다.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <div className="text-5xl">⚙</div>
          <h1 className="mt-5 text-xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-gray-400">준비 중인 기능입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="mb-2 text-sm font-medium text-gray-400">
            EMPLOYEE ACCOUNTS
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            임직원 계정 관리
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            사내 정보 센터를 이용할 임직원 계정을 등록하고 관리하세요.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen((prev) => !prev)}
          className="shrink-0 cursor-pointer rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          {isFormOpen ? "닫기" : "+ 직원 추가"}
        </button>
      </div>

      {/* 계정 생성 폼 */}

      {isFormOpen && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 text-sm font-semibold">새 계정 등록</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                이메일
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="employee@company.com"
                disabled={isCreating}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                이름
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="홍길동"
                disabled={isCreating}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                권한
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value as "admin" | "employee")
                }
                disabled={isCreating}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
              >
                <option value="employee">임직원</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                초기 비밀번호
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상"
                disabled={isCreating}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            생성된 계정 정보(이메일/초기 비밀번호)를 해당 임직원에게 별도로
            전달해주세요.
          </p>

          <button
            onClick={handleCreateUser}
            disabled={isCreating}
            className="mt-4 cursor-pointer rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isCreating ? "생성 중..." : "계정 생성"}
          </button>
        </div>
      )}

      {/* 임직원 목록 */}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold">
            전체 계정 {users.length}개
          </div>

          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="cursor-pointer text-xs text-gray-400 hover:text-black disabled:cursor-not-allowed"
          >
            {isLoading ? "새로고침 중..." : "새로고침"}
          </button>
        </div>

        {users.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-sm text-gray-400">
            등록된 계정이 없습니다.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {users.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-5 ${
                  index !== users.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-sm font-bold text-white">
                    {item.name?.[0] || "?"}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.name}</span>
                      {item.id === user?.id && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          본인
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {item.email} ·{" "}
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}{" "}
                      가입
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={item.role}
                    onChange={(e) => handleRoleChange(item.id, e.target.value)}
                    disabled={updatingId === item.id}
                    className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-black disabled:cursor-not-allowed"
                  >
                    <option value="employee">임직원</option>
                    <option value="admin">관리자</option>
                  </select>

                  <button
                    onClick={() => handleDeleteUser(item.id, item.name)}
                    disabled={deletingId === item.id || item.id === user?.id}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingId === item.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
