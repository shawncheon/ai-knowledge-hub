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

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  const [searchType, setSearchType] = useState<"name" | "email">("name");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  // 검색 조건이 바뀌면 항상 1페이지로 되돌림
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchType]);

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

  const handleCloseForm = () => {
    if (isCreating) return;
    resetForm();
    setIsFormOpen(false);
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

  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === user?.id) return -1;
    if (b.id === user?.id) return 1;
    return 0;
  });

  const filteredUsers = sortedUsers.filter((item) => {
    if (!searchQuery.trim()) return true;
    const target = searchType === "name" ? item.name : item.email;
    return target.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / usersPerPage),
  );

  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage,
  );

  if (isLoadingUser || (user && user.role !== "admin")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">
          EMPLOYEE ACCOUNTS
        </div>
        <h1 className="text-3xl font-bold tracking-tight">임직원 관리</h1>
        <p className="mt-2 text-sm text-gray-500">
          사내 정보 센터를 이용할 임직원 계정을 등록하고 관리하세요.
        </p>
      </div>

      {/* 임직원 목록 (테이블) */}

      <section>
        <div className="mb-4 grid grid-cols-3 items-end">
          <div className="text-sm font-semibold">
            전체 계정 {filteredUsers.length}개
          </div>

          <div className="flex justify-center">
            <div className="flex w-full max-w-md items-center rounded-full border border-gray-200 bg-white pl-2 shadow-sm">
              <select
                value={searchType}
                onChange={(e) =>
                  setSearchType(e.target.value as "name" | "email")
                }
                className="cursor-pointer rounded-full bg-transparent px-3 py-3 text-sm text-gray-600 outline-none"
              >
                <option value="name">이름</option>
                <option value="email">이메일</option>
              </select>

              <div className="h-5 w-px bg-gray-200" />

              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder={
                  searchType === "name" ? "이름으로 검색" : "이메일로 검색"
                }
                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-400"
              />

              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="cursor-pointer px-2 text-gray-400 hover:text-gray-700"
                  title="검색 초기화"
                >
                  ✕
                </button>
              )}

              <button
                onClick={handleSearch}
                className="mr-1 cursor-pointer rounded-full bg-[#2452D9] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0]"
              >
                검색
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={() => setIsFormOpen(true)}
              className="cursor-pointer rounded-xl bg-[#2452D9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0]"
            >
              직원 추가
            </button>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 계정이 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#2452D9] text-xs text-white">
                  <th className="w-16 px-5 py-3 text-center font-semibold">
                    번호
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">이름</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    이메일
                  </th>
                  <th className="w-32 px-3 py-3 text-center font-semibold">
                    권한수정
                  </th>
                  <th className="w-20 px-3 py-3 text-center font-semibold">
                    계정수정
                  </th>
                  <th className="w-20 px-3 py-3 text-center font-semibold">
                    계정삭제
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedUsers.map((item, index) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-5 py-4 text-gray-400">
                        {(currentPage - 1) * usersPerPage + index + 1}
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isSavingEdit}
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          disabled={isSavingEdit}
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-4 text-xs text-gray-300">-</td>
                      <td colSpan={2} className="px-3 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isSavingEdit}
                            className="cursor-pointer rounded-lg bg-[#2452D9] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed"
                          >
                            {isSavingEdit ? "저장 중..." : "저장"}
                          </button>

                          <button
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-5 py-4 text-gray-400">
                        {(currentPage - 1) * usersPerPage + index + 1}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.name}</span>
                          {item.id === user?.id && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              본인
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-gray-500">{item.email}</td>

                      <td className="px-3 py-4">
                        <select
                          value={item.role}
                          onChange={(e) =>
                            handleRoleChange(item.id, e.target.value)
                          }
                          disabled={updatingId === item.id}
                          className="cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#2452D9] disabled:cursor-not-allowed"
                        >
                          <option value="employee">임직원</option>
                          <option value="admin">관리자</option>
                        </select>
                      </td>

                      <td className="px-3 py-4">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        >
                          수정
                        </button>
                      </td>

                      <td className="px-3 py-4">
                        <button
                          onClick={() => handleDeleteUser(item.id, item.name)}
                          disabled={
                            deletingId === item.id || item.id === user?.id
                          }
                          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === item.id ? "삭제 중..." : "삭제"}
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                disabled={totalPages === 1}
                className={`h-8 w-8 rounded-lg text-sm transition ${
                  currentPage === pageNum
                    ? "bg-[#2452D9] font-semibold text-white"
                    : "text-gray-500 hover:bg-gray-100"
                } ${
                  totalPages === 1 ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {pageNum}
              </button>
            ),
          )}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </section>

      {/* =====================================
          새 계정 등록 팝업
      ====================================== */}

      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCloseForm}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="text-lg font-bold">새 계정 등록</div>

              <button
                onClick={handleCloseForm}
                disabled={isCreating}
                className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
              >
                ✕
              </button>
            </div>

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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed disabled:bg-gray-50"
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed disabled:bg-gray-50"
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed disabled:bg-gray-50"
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2452D9] disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              생성된 계정 정보(이메일/초기 비밀번호)를 해당 임직원에게 별도로
              전달해주세요. 임직원은 로그인 후 [비밀번호 변경] 메뉴에서 직접
              비밀번호를 바꿀 수 있습니다.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={handleCreateUser}
                disabled={isCreating}
                className="w-32 cursor-pointer rounded-lg bg-[#2452D9] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isCreating ? "생성 중..." : "저장"}
              </button>

              <button
                onClick={handleCloseForm}
                disabled={isCreating}
                className="w-32 cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
