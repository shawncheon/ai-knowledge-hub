"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import HistoryDetailModal, {
  HistoryItem,
} from "@/components/HistoryDetailModal";
import { useDocumentDownload } from "@/hooks/useDocumentDownload";

interface DocumentItem {
  id: string;
  file_name: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();
  const { downloadingId, handleDownload } = useDocumentDownload();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoadingUser, user, router]);

  const loadDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      if (response.ok && data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("문서 목록 조회 실패:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (response.ok && data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("히스토리 조회 실패:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadHistory();
  }, []);

  const getWeeklyQuestionCounts = () => {
    const days: { label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString("ko-KR", { weekday: "short" });
      const dateStr = d.toDateString();
      const count = history.filter(
        (h) => new Date(h.created_at).toDateString() === dateStr,
      ).length;
      days.push({ label, count });
    }

    return days;
  };

  if (isLoadingUser || (user && user.role !== "admin")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  const weeklyCounts = getWeeklyQuestionCounts();
  const maxCount = Math.max(...weeklyCounts.map((d) => d.count), 1);

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">OVERVIEW</div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="mt-2 text-sm text-gray-500">
          AI Knowledge Hub의 전체 현황을 확인하세요.
        </p>
      </div>

      {/* 통계 카드 */}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">전체 문서</div>
          <div className="mt-2 text-2xl font-bold">{documents.length}</div>
          <div className="mt-1 text-xs text-gray-400">Documents</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">등록된 청크</div>
          <div className="mt-2 text-2xl font-bold">
            {documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)}
          </div>
          <div className="mt-1 text-xs text-gray-400">Chunks</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs text-gray-400">총 질문 수</div>
          <div className="mt-2 text-2xl font-bold">{history.length}</div>
          <div className="mt-1 text-xs text-gray-400">Questions</div>
        </div>
      </div>

      {/* 최근 7일 질문 추이 */}

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">최근 7일 질문 추이</h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex h-40 items-end justify-between gap-3">
            {weeklyCounts.map((day, index) => (
              <div
                key={index}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <div className="mb-2 text-xs font-semibold text-gray-600">
                  {day.count}
                </div>
                <div
                  className="w-full rounded-t-md bg-[#2452D9] transition-all"
                  style={{
                    height: `${(day.count / maxCount) * 100}%`,
                    minHeight: day.count > 0 ? "4px" : "0",
                  }}
                />
                <div className="mt-2 text-xs text-gray-400">{day.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 최근 업로드 문서 + 최근 질문 */}

      <div className="mt-8 grid grid-cols-2 gap-6">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">최근 업로드 문서</h2>
            <Link
              href="/documents"
              className="cursor-pointer text-xs text-gray-400 hover:text-black"
            >
              전체 보기 →
            </Link>
          </div>

          {documents.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              등록된 문서가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 3).map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex cursor-pointer items-center rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-400"
                >
                  <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-base">
                    📄
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {doc.file_name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">최근 질문</h2>
            <Link
              href="/history"
              className="cursor-pointer text-xs text-gray-400 hover:text-black"
            >
              전체 보기 →
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              아직 질문 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedHistoryItem(item)}
                  className="flex w-full cursor-pointer items-center rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-gray-400"
                >
                  <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                    ⌕
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {item.question}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <HistoryDetailModal
        item={selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        onDownload={handleDownload}
        downloadingId={downloadingId}
      />
    </>
  );
}
