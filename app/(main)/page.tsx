"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useDocumentDownload } from "@/hooks/useDocumentDownload";
import HistoryDetailModal, {
  HistoryItem,
  SourceItem,
} from "@/components/HistoryDetailModal";

export default function AISearchPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();
  const { downloadingId, handleDownload } = useDocumentDownload();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<HistoryItem | null>(null);

  const recommendedQuestions = [
    "출장비 기준",
    "연차 사용 기준",
    "복지제도 안내",
  ];

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
    loadHistory();
  }, []);

  const handleSearch = async () => {
    if (!question.trim()) {
      alert("질문을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const contentType = response.headers.get("content-type") || "";

      let data: { answer?: string; error?: string; sources?: SourceItem[] };

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = { error: await response.text() };
      }

      if (!response.ok) {
        setAnswer(`오류가 발생했습니다.\n\n${data.error || "AI 요청 실패"}`);
        return;
      }

      setAnswer(data.answer || "");
      setSources(data.sources || []);

      loadHistory();
    } catch (error) {
      console.error("Fetch Error:", error);
      setAnswer("AI 서버에 연결하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryContinue = (item: HistoryItem) => {
    setQuestion(item.question);
    setAnswer(item.answer);
    setSources(item.sources || []);
    setSelectedHistoryItem(null);
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
        <div className="mb-2 text-sm font-medium text-gray-400">
          AI KNOWLEDGE HUB
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          무엇을 찾고 계신가요?
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          회사의 문서와 지식을 AI에게 질문해보세요.
        </p>
      </div>

      {/* 추천 질문 */}

      <section className="mt-8">
        <div className="mb-4 text-sm font-semibold">추천 질문</div>

        <div className="grid grid-cols-3 gap-4">
          {recommendedQuestions.map((item) => (
            <button
              key={item}
              onClick={() => setQuestion(item)}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gray-400 hover:shadow-sm"
            >
              <div className="mb-3 text-lg">✦</div>
              <div className="text-sm font-semibold">{item}</div>
              <div className="mt-2 text-xs text-gray-400">
                AI에게 질문하기 →
              </div>
            </button>
          ))}
        </div>
      </section>

      <br />

      {/* 검색 */}

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center">
          <div className="px-4 text-xl text-gray-400">⌕</div>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="예: 출장 숙박비 기준을 알려줘"
            className="flex-1 bg-transparent px-2 py-4 text-base outline-none placeholder:text-gray-400"
          />

          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="rounded-xl bg-[#2452D9] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? "검색 중..." : "검색"}
          </button>
        </div>
      </div>

      {/* AI 답변 */}

      {answer && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold">AI 답변</div>
            <div className="text-xs text-gray-400">Gemini</div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
              {answer}
            </div>

            <div className="mt-7 border-t border-gray-100 pt-5">
              <div className="mb-2 text-xs font-semibold text-gray-500">
                참고 문서
              </div>

              {sources.length === 0 ? (
                <div className="text-xs text-gray-400">
                  참고한 문서가 없습니다.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => handleDownload(source.id, source.fileName)}
                      disabled={downloadingId === source.id}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      📄 {source.fileName}
                      <span className="text-gray-400">↓</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 최근 질문 */}

      {history.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold">최근 질문</div>

            <a
              href="/history"
              className="cursor-pointer text-xs text-gray-400 hover:text-black"
            >
              전체 보기 →
            </a>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {history.slice(0, 3).map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedHistoryItem(item)}
                className={`flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left hover:bg-gray-50 ${
                  index !== history.slice(0, 3).length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                    ⌕
                  </div>
                  <span className="text-sm text-gray-700">{item.question}</span>
                </div>
                <span className="ml-4 shrink-0 text-gray-300">→</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <HistoryDetailModal
        item={selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        onDownload={handleDownload}
        downloadingId={downloadingId}
        onContinue={handleHistoryContinue}
      />
    </>
  );
}
