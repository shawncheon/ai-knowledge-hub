"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();

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

  // 인라인 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/settings/profile");
    }
  }, [isLoadingUser, user, router]);

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

  // =========================
  // 인라인 수정
  // =========================
  const handleStartEdit = (item: UserItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditEmail(item.email);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editEmail.trim()) {
      alert("이름과 이메일을 모두 입력해주세요.");
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "정보 수정에 실패했습니다.");
      }

      setEditingId(null);
      await loadUsers();
    } catch (error) {
      console.error("Edit Save Error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "정보 수정 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoadingUser || (user && user.role !== "admin")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
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
          <h1 className="text-3xl font-bold tracking-tight">임직원 관리</h1>
          <p className="mt-2 text-sm text-gray-500">
            사내 정보 센터를 이용할 임직원 계정을 등록하고 관리하세요.
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen((prev) => !prev)}
          className="shrink-0 cursor-pointer rounded-xl bg-[#2452D9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1D3FB0]"
        >
          {isFormOpen ? "닫기" : "+ 직원 추가"}
        </button>
      </div>

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
            전달해주세요. 임직원은 로그인 후 [비밀번호 변경] 메뉴에서 직접
            비밀번호를 바꿀 수 있습니다.
          </p>
          <div className="flex justify-end">
            <button
              onClick={handleCreateUser}
              disabled={isCreating}
              className="mt-4 cursor-pointer rounded-lg bg-[#2452D9] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isCreating ? "생성 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

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
                className={`p-5 ${
                  index !== users.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {editingId === item.id ? (
                  // ============ 인라인 수정 폼 ============
                  <div>
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                          이름
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isSavingEdit}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                          이메일
                        </label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          disabled={isSavingEdit}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 flex justify-end">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={isSavingEdit}
                        className="cursor-pointer rounded-lg bg-black px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed"
                      >
                        {isSavingEdit ? "저장 중..." : "저장"}
                      </button>

                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // ============ 일반 표시 ============
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2452D9] text-sm font-bold text-white">
                        {item.name?.[0] || "?"}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {item.name}
                          </span>
                          {item.id === user?.id && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              본인
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {item.email} ·{" "}
                          {new Date(item.created_at).toLocaleDateString(
                            "ko-KR",
                          )}{" "}
                          가입
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={item.role}
                        onChange={(e) =>
                          handleRoleChange(item.id, e.target.value)
                        }
                        disabled={updatingId === item.id}
                        className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-black disabled:cursor-not-allowed"
                      >
                        <option value="employee">임직원</option>
                        <option value="admin">관리자</option>
                      </select>

                      <button
                        onClick={() => handleStartEdit(item)}
                        className="cursor-pointer rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        수정
                      </button>

                      <button
                        onClick={() => handleDeleteUser(item.id, item.name)}
                        disabled={
                          deletingId === item.id || item.id === user?.id
                        }
                        className="cursor-pointer rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingId === item.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
