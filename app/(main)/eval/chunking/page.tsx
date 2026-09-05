"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

interface VariantResult {
  question: string;
  score: number;
  reason: string;
}

interface VariantSummary {
  variant: string;
  avgScore: number;
  results: VariantResult[];
}

export default function ChunkingExperimentPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();

  // 입력값 상태 (기본값은 지금까지 쓰던 값으로)
  const [chunkSizeA, setChunkSizeA] = useState("800");
  const [overlapA, setOverlapA] = useState("100");
  const [chunkSizeB, setChunkSizeB] = useState("400");
  const [overlapB, setOverlapB] = useState("50");

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState("");
  const [preparedVariantNames, setPreparedVariantNames] = useState<
    string[] | null
  >(null);

  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<VariantSummary[]>([]);

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoadingUser, user, router]);

  const handlePrepare = async () => {
    if (!chunkSizeA || !overlapA || !chunkSizeB || !overlapB) {
      alert("모든 값을 입력해주세요.");
      return;
    }

    const confirmed = window.confirm(
      `A안: ${chunkSizeA}자 / 오버랩 ${overlapA}\nB안: ${chunkSizeB}자 / 오버랩 ${overlapB}\n\n전체 문서를 이 두 방식으로 다시 청킹하고 임베딩을 생성합니다.\n계속하시겠습니까?`,
    );
    if (!confirmed) return;

    setIsPreparing(true);
    setPrepareMessage("");
    setPreparedVariantNames(null);
    setSummary([]);

    try {
      const response = await fetch("/api/eval/chunking/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkSizeA, overlapA, chunkSizeB, overlapB }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "준비 작업에 실패했습니다.");
      }

      setPrepareMessage(
        `✅ ${data.message} (총 ${data.totalChunks}개 청크 생성됨)`,
      );
      setPreparedVariantNames(data.variants);
    } catch (error) {
      alert(error instanceof Error ? error.message : "준비 작업 중 오류");
    } finally {
      setIsPreparing(false);
    }
  };

  const handleRunComparison = async () => {
    if (!preparedVariantNames) {
      alert("먼저 '① 실험 데이터 준비'를 실행해주세요.");
      return;
    }

    const confirmed = window.confirm(
      "골든셋 질문들을 두 가지 청킹 방식으로 각각 다시 채점합니다.\n계속하시겠습니까?",
    );
    if (!confirmed) return;

    setIsRunning(true);
    setSummary([]);

    try {
      const response = await fetch("/api/eval/chunking/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantNames: preparedVariantNames }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "비교 실행에 실패했습니다.");
      }

      setSummary(data.summary);
    } catch (error) {
      alert(error instanceof Error ? error.message : "비교 실행 중 오류");
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

  const winner =
    summary.length === 2
      ? summary[0].avgScore >= summary[1].avgScore
        ? summary[0]
        : summary[1]
      : null;

  return (
    <>
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">EXPERIMENT</div>
        <h1 className="text-3xl font-bold tracking-tight">
          청킹 전략 A/B 비교 실험
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          청크 크기와 오버랩 값을 직접 입력해 골든셋 기준으로 비교합니다.
        </p>
      </div>

      {/* 1단계: 값 입력 + 준비 */}

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-1 text-sm font-semibold">
          1단계 — 청킹 값 입력 및 실험 데이터 준비
        </div>
        <p className="mb-4 text-xs text-gray-400">
          두 가지 방식(A안, B안)의 청크 크기와 오버랩을 입력하세요. 오버랩은
          청크 크기보다 작아야 합니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 text-xs font-semibold text-gray-500">A안</div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-gray-500">
                청크 크기 (자)
              </label>
              <input
                type="number"
                value={chunkSizeA}
                onChange={(e) => setChunkSizeA(e.target.value)}
                disabled={isPreparing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2452D9] disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                오버랩 (자)
              </label>
              <input
                type="number"
                value={overlapA}
                onChange={(e) => setOverlapA(e.target.value)}
                disabled={isPreparing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2452D9] disabled:bg-gray-50"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 text-xs font-semibold text-gray-500">B안</div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-gray-500">
                청크 크기 (자)
              </label>
              <input
                type="number"
                value={chunkSizeB}
                onChange={(e) => setChunkSizeB(e.target.value)}
                disabled={isPreparing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2452D9] disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                오버랩 (자)
              </label>
              <input
                type="number"
                value={overlapB}
                onChange={(e) => setOverlapB(e.target.value)}
                disabled={isPreparing}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2452D9] disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handlePrepare}
          disabled={isPreparing}
          className="mt-4 cursor-pointer rounded-xl bg-[#2452D9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isPreparing ? "준비 중..." : "① 실험 데이터 준비"}
        </button>

        {prepareMessage && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            {prepareMessage}
          </div>
        )}
      </section>

      {/* 2단계: 비교 실행 */}

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-1 text-sm font-semibold">2단계 — 비교 채점 실행</div>
        <p className="mb-4 text-xs text-gray-400">
          골든셋 질문 전체를 두 방식 각각에 대해 검색·답변·채점합니다. (1단계
          완료 후 실행하세요)
        </p>

        <button
          onClick={handleRunComparison}
          disabled={isRunning || !preparedVariantNames}
          className="cursor-pointer rounded-xl bg-[#2452D9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D3FB0] disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isRunning ? "비교 실행 중..." : "② 비교 실행"}
        </button>
      </section>

      {/* 결과 */}

      {summary.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4">
            {summary.map((s) => (
              <div
                key={s.variant}
                className={`rounded-xl border-2 bg-white p-5 ${
                  winner?.variant === s.variant
                    ? "border-[#2452D9]"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400">{s.variant}</div>
                  {winner?.variant === s.variant && (
                    <span className="rounded-full bg-[#2452D9] px-2 py-0.5 text-[10px] font-bold text-white">
                      우세
                    </span>
                  )}
                </div>
                <div className="mt-2 text-3xl font-bold">{s.avgScore}점</div>
                <div className="mt-1 text-xs text-gray-400">평균 점수</div>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 text-sm font-semibold">문항별 상세 비교</div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {summary[0].results.map((_, index) => (
                <div
                  key={index}
                  className={`p-5 ${
                    index !== summary[0].results.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <div className="mb-3 text-sm font-semibold">
                    {summary[0].results[index].question}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {summary.map((s) => (
                      <div
                        key={s.variant}
                        className="rounded-lg bg-gray-50 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {s.variant}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${getScoreColor(
                              s.results[index].score,
                            )}`}
                          >
                            {s.results[index].score}점
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {s.results[index].reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
