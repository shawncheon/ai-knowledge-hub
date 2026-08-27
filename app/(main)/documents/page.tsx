"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";

interface DocumentItem {
  id: string;
  file_name: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
}

export default function DocumentsListPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoadingUser, user, router]);

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      if (response.ok && data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("문서 목록 조회 실패:", error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocuments = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()),
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
          INFORMATION MANAGEMENT
        </div>
        <h1 className="text-3xl font-bold tracking-tight">정보 관리</h1>
        <p className="mt-2 text-sm text-gray-500">
          AI가 검색할 회사 지식 정보를 등록하고 관리하세요.
        </p>
      </div>

      {/* 통계 */}

      <div className="mb-3 flex justify-end">
        <Link
          href="/documents/register"
          className="shrink-0 cursor-pointer rounded-xl bg-[#2452D9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1D3FB0]"
        >
          정보 등록
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">전체 문서</div>
          <div className="mt-2 text-2xl font-bold">{documents.length}</div>
          <div className="mt-1 text-xs text-gray-400">Documents</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">처리 완료</div>
          <div className="mt-2 text-2xl font-bold">{documents.length}</div>
          <div className="mt-1 text-xs text-gray-400">Completed</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">지식 Chunk</div>
          <div className="mt-2 text-2xl font-bold">
            {documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)}
          </div>
          <div className="mt-1 text-xs text-gray-400">Chunks</div>
        </div>
      </div>

      {/* 검색 + 목록 */}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
              ⌕
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="문서명으로 검색"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-black"
            />
          </div>

          <button
            onClick={loadDocuments}
            disabled={isLoadingDocuments}
            className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
          >
            {isLoadingDocuments ? "새로고침 중..." : "새로고침"}
          </button>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
            <div className="text-4xl">📂</div>
            <h3 className="mt-5 text-base font-semibold">
              {searchQuery
                ? "검색 결과가 없습니다."
                : "등록된 문서가 없습니다."}
            </h3>
            <p className="mt-2 text-sm text-gray-400">
              {searchQuery
                ? "다른 검색어로 시도해보세요."
                : "우측 상단의 [정보 등록] 버튼으로 문서를 등록하세요."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-400 hover:shadow-sm"
              >
                <div className="flex items-center">
                  <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
                    📄
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{doc.file_name}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                      {" · "}
                      {doc.chunk_count} chunks
                      {" · "}
                      {new Date(doc.created_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
                    처리 완료
                  </div>
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
