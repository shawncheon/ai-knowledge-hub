"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

interface EvalHistoryItem {
  runBatch: string;
  avgScore: number;
  questionCount: number;
}

interface EvalResult {
  question: string;
  score: number;
  reason: string;
  success: boolean;
}

export default function EvalPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [runBatch, setRunBatch] = useState("");
  const [history, setHistory] = useState<EvalHistoryItem[]>([]);

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/eval/history");
      const data = await response.json();
      if (response.ok && data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("이력 조회 실패:", error);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadHistory();
    }
  }, [user]);

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoadingUser, user, router]);

  const handleRunEval = async () => {
    const confirmed = window.confirm(
      "평가를 실행하면 골든셋 질문 수만큼 AI 호출이 발생합니다.\n(질문마다 검색 1회 + 답변 생성 1회 + 채점 1회)\n계속하시겠습니까?",
    );

    if (!confirmed) return;

    setIsRunning(true);
    setResults([]);
    setAvgScore(null);

    try {
      const response = await fetch("/api/eval/run", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "평가 실행에 실패했습니다.");
      }

      setResults(data.results);
      setAvgScore(data.avgScore);
      setRunBatch(data.runBatch);
      await loadHistory();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "평가 실행 중 오류가 발생했습니다.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 50) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
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
            EVALUATION
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            RAG 답변 정확도 평가
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            골든셋(질문-정답 쌍) 기준으로 AI 답변 품질을 자동으로 채점합니다.
          </p>
        </div>

        <button
          onClick={handleRunEval}
          disabled={isRunning}
          className="shrink-0 cursor-pointer rounded-xl bg-[#2452D9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isRunning ? "평가 실행 중..." : "▶ 평가 실행"}
        </button>
      </div>

      {isRunning && (
        <div className="mb-6 flex items-center rounded-xl border border-gray-200 bg-white p-4">
          <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-[#2452D9]" />
          <span className="text-sm text-gray-600">
            골든셋 질문들을 순차적으로 처리하고 채점하는 중입니다. 질문 개수에
            따라 몇 분 정도 걸릴 수 있어요.
          </span>
        </div>
      )}

      {avgScore !== null && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-xs text-gray-400">평균 점수</div>
              <div className="mt-2 text-2xl font-bold">{avgScore}점</div>
              <div className="mt-1 text-xs text-gray-400">
                100점 만점 (기술적 실패 건 제외)
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-xs text-gray-400">평가 문항 수</div>
              <div className="mt-2 text-2xl font-bold">{results.length}개</div>
              <div className="mt-1 text-xs text-gray-400">
                {results.filter((r) => r.score >= 80).length}개 우수 (80점 이상)
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-xs text-gray-400">평가 회차</div>
              <div className="mt-2 text-sm font-bold">{runBatch}</div>
              <div className="mt-1 text-xs text-gray-400">
                실패 {results.filter((r) => !r.success).length}건
              </div>
            </div>
          </div>

          <section>
            <div className="mb-4 text-sm font-semibold">문항별 결과</div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-5 ${
                    index !== results.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        {result.question}
                      </div>
                      <div className="mt-1.5 text-xs text-gray-500">
                        {result.reason}
                      </div>
                    </div>

                    <div
                      className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${getScoreColor(
                        result.score,
                      )}`}
                    >
                      {result.score}점
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {history.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 text-sm font-semibold">평가 이력 추이</div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {history.map((h, index) => (
              <div
                key={h.runBatch}
                className={`flex items-center justify-between p-4 ${
                  index !== history.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div className="text-sm text-gray-600">{h.runBatch}</div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">
                    {h.questionCount}문항
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${getScoreColor(
                      h.avgScore,
                    )}`}
                  >
                    {h.avgScore}점
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {avgScore === null && !isRunning && (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center">
          <div className="text-4xl">📊</div>
          <h3 className="mt-5 text-base font-semibold">
            아직 평가를 실행하지 않았습니다.
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            "▶ 평가 실행" 버튼을 눌러 골든셋 기준 채점을 시작하세요.
          </p>
        </div>
      )}
    </>
  );
}
