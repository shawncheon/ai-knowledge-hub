"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useDocumentDownload } from "@/hooks/useDocumentDownload";
import HistoryDetailModal, {
  HistoryItem,
} from "@/components/HistoryDetailModal";

export default function HistoryPage() {
  const { user } = useUser();
  const { downloadingId, handleDownload } = useDocumentDownload();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<HistoryItem | null>(null);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (response.ok && data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("히스토리 조회 실패:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);
  const handleSearch = () => {
    setSearchQuery(searchInput);
  };
  const searchTerms = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  const filteredHistory = history.filter((item) => {
    if (searchTerms.length === 0) return true;

    const combinedText = `${item.question} ${item.answer}`.toLowerCase();

    // 검색어의 모든 단어가 (순서 상관없이) 포함되어 있으면 매칭
    return searchTerms.every((term) => combinedText.includes(term));
  });

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">
          QUESTION HISTORY
        </div>
        <h1 className="text-3xl font-bold tracking-tight">질문 기록</h1>
        <p className="mt-2 text-sm text-gray-500">
          {user?.role === "admin"
            ? "전체 임직원의 질문 기록입니다. 개인 식별 정보는 표시되지 않습니다."
            : "지금까지 AI에게 물어본 질문과 답변을 확인하세요."}
        </p>
      </div>

      {history.length > 0 && (
        <div className="mb-6 flex justify-center">
          <div className="flex w-full max-w-md items-center rounded-full border border-gray-200 bg-white pl-2 shadow-sm">
            <div className="pl-2 text-gray-400">⌕</div>

            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="질문 또는 답변 내용으로 검색"
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-400"
            />

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
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
      )}

      {isLoadingHistory ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-sm text-gray-400">
          불러오는 중...
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
          <div className="text-4xl">💬</div>
          <h3 className="mt-5 text-base font-semibold">
            아직 질문 기록이 없습니다.
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            AI Search에서 질문을 해보세요.
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
          <div className="text-4xl">🔍</div>
          <h3 className="mt-5 text-base font-semibold">
            검색 결과가 없습니다.
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            다른 검색어로 시도해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedHistoryItem(item)}
              className="block w-full cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 text-left transition hover:border-gray-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                    ⌕
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {item.question}
                  </span>
                </div>

                <span className="whitespace-nowrap text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleString("ko-KR")}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 pl-11 text-sm text-gray-500">
                {item.answer}
              </p>

              {item.sources && item.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 pl-11">
                  {item.sources.map((source) => (
                    <span
                      key={source.id}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
                    >
                      📄 {source.fileName}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <HistoryDetailModal
        item={selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        onDownload={handleDownload}
        downloadingId={downloadingId}
      />
    </>
  );
}
