"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

type RegisterMethod = "batch" | "url" | "text";

interface BatchFileStatus {
  file: File;
  status: "waiting" | "uploading" | "success" | "error";
  errorMessage?: string;
}

export default function DocumentRegisterPage() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useUser();

  const [method, setMethod] = useState<RegisterMethod>("batch");

  // 일괄(파일) 업로드 상태
  const [batchFiles, setBatchFiles] = useState<BatchFileStatus[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // 직접 입력 상태
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isSubmittingText, setIsSubmittingText] = useState(false);

  useEffect(() => {
    if (!isLoadingUser && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoadingUser, user, router]);

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf";
    const isExcel =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      fileName.endsWith(".csv");

    if (!isPdf && !isExcel) {
      return "PDF 또는 Excel(.xlsx, .xls, .csv) 파일만 가능합니다.";
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return "파일 크기는 10MB 이하만 가능합니다.";
    }

    return null;
  };

  // =========================
  // 파일 업로드 (여러 개 가능)
  // =========================
  const handleBatchFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles: BatchFileStatus[] = [];
    const invalidNames: string[] = [];

    files.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        invalidNames.push(`${file.name} (${error})`);
      } else {
        validFiles.push({ file, status: "waiting" });
      }
    });

    if (invalidNames.length > 0) {
      alert(`아래 파일은 제외되었습니다:\n\n${invalidNames.join("\n")}`);
    }

    setBatchFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveBatchFile = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearBatch = () => {
    setBatchFiles([]);
    if (batchInputRef.current) {
      batchInputRef.current.value = "";
    }
  };

  const handleBatchUpload = async (onlyIndexes?: number[]) => {
    if (batchFiles.length === 0) {
      alert("먼저 파일을 선택해주세요.");
      return;
    }

    setIsBatchUploading(true);

    const targetIndexes = onlyIndexes ?? batchFiles.map((_, idx) => idx);

    for (let listIdx = 0; listIdx < targetIndexes.length; listIdx++) {
      const i = targetIndexes[listIdx];

      if (listIdx > 0) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }

      setBatchFiles((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading" } : item
        )
      );

      try {
        const formData = new FormData();
        formData.append("type", "file");
        formData.append("file", batchFiles[i].file);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const contentType = response.headers.get("content-type") || "";

        let data: { success?: boolean; error?: string };

        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = { error: await response.text() };
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || "업로드 실패");
        }

        setBatchFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "success" } : item
          )
        );
      } catch (error) {
        setBatchFiles((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "error",
                  errorMessage:
                    error instanceof Error ? error.message : "업로드 실패",
                }
              : item
          )
        );
      }
    }

    setIsBatchUploading(false);
  };

  const batchSuccessCount = batchFiles.filter(
    (f) => f.status === "success"
  ).length;
  const batchErrorCount = batchFiles.filter(
    (f) => f.status === "error"
  ).length;
  const batchDone =
    batchFiles.length > 0 &&
    batchFiles.every((f) => f.status === "success" || f.status === "error");

  // =========================
  // 직접 입력
  // =========================
  const handleSubmitText = async () => {
    if (!textTitle.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!textContent.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setIsSubmittingText(true);

    try {
      const formData = new FormData();
      formData.append("type", "text");
      formData.append("title", textTitle.trim());
      formData.append("content", textContent.trim());

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";

      let data: {
        success?: boolean;
        document?: { fileName: string };
        error?: string;
      };

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = { error: await response.text() };
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "등록에 실패했습니다.");
      }

      alert(
        `정보 등록이 완료되었습니다.\n\n제목: ${
          data.document?.fileName || textTitle
        }`
      );

      router.push("/documents");
    } catch (error) {
      console.error("Text Register Error:", error);
      alert(
        error instanceof Error ? error.message : "등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmittingText(false);
    }
  };

  if (isLoadingUser || (user && user.role !== "admin")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  const methodCards: {
    key: RegisterMethod;
    icon: string;
    title: string;
    desc: string;
    enabled: boolean;
  }[] = [
    {
      key: "batch",
      icon: "📄",
      title: "파일 업로드",
      desc: "PDF, Excel, CSV (여러 개 가능)",
      enabled: true,
    },
    { key: "url", icon: "🔗", title: "URL 등록", desc: "준비 중", enabled: false },
    {
      key: "text",
      icon: "✎",
      title: "직접 입력",
      desc: "텍스트로 바로 등록",
      enabled: true,
    },
  ];

  const statusLabel: Record<BatchFileStatus["status"], string> = {
    waiting: "대기 중",
    uploading: "처리 중...",
    success: "완료",
    error: "실패",
  };

  return (
    <>
      <button
        onClick={() => router.push("/documents")}
        className="mb-6 flex cursor-pointer items-center text-sm text-gray-500 hover:text-black"
      >
        ← 목록으로
      </button>

      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-gray-400">
          REGISTER INFORMATION
        </div>
        <h1 className="text-3xl font-bold tracking-tight">정보 등록</h1>
        <p className="mt-2 text-sm text-gray-500">
          등록 방식을 선택하고 정보를 등록하세요.
        </p>
      </div>

      {/* 등록 방식 선택 카드 */}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {methodCards.map((card) => (
          <button
            key={card.key}
            onClick={() => card.enabled && setMethod(card.key)}
            disabled={!card.enabled}
            className={`rounded-xl border p-4 text-left transition ${
              !card.enabled
                ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                : method === card.key
                ? "cursor-pointer border-2 border-black bg-white"
                : "cursor-pointer border-gray-200 bg-white hover:border-gray-400"
            }`}
          >
            <div className="mb-2 text-xl">{card.icon}</div>
            <div className="text-sm font-semibold">{card.title}</div>
            <div className="mt-1 text-xs text-gray-400">{card.desc}</div>
          </button>
        ))}
      </div>

      {/* ============ 파일 업로드 (단일 박스에서 상태 전환) ============ */}

      {method === "batch" && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
            📚
          </div>

          <h2 className="mt-5 text-lg font-semibold">문서를 업로드하세요</h2>

          <p className="mt-2 text-sm text-gray-400">
            여러 파일을 동시에 업로드할 수 있습니다. (1개만 선택해도 됩니다)
          </p>

          <input
            ref={batchInputRef}
            id="batch-upload"
            type="file"
            accept="application/pdf,.xlsx,.xls,.csv"
            multiple
            onChange={handleBatchFileChange}
            disabled={isBatchUploading}
            className="hidden"
          />

          {batchFiles.length === 0 ? (
            <>
              <label
                htmlFor="batch-upload"
                className="mt-6 inline-block cursor-pointer rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                파일 선택
              </label>

              <div className="mt-4 text-xs text-gray-400">
                PDF, Excel(.xlsx, .xls, .csv) · 파일당 최대 10MB
              </div>
            </>
          ) : (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  선택된 파일 {batchFiles.length}개
                  {batchDone && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      (완료 {batchSuccessCount} · 실패 {batchErrorCount})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {!isBatchUploading && !batchDone && (
                    <label
                      htmlFor="batch-upload"
                      className="cursor-pointer text-xs text-gray-500 hover:text-black"
                    >
                      + 파일 추가
                    </label>
                  )}

                  {!isBatchUploading && (
                    <button
                      onClick={handleClearBatch}
                      className="cursor-pointer text-xs text-gray-400 hover:text-black"
                    >
                      전체 지우기
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {batchFiles.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3"
                  >
                    <div className="flex min-w-0 items-center">
                      <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">
                        📄
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-gray-700">
                          {item.file.name}
                        </div>
                        {item.status === "error" && (
                          <div className="mt-0.5 truncate text-xs text-red-500">
                            {item.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          item.status === "success"
                            ? "text-green-600"
                            : item.status === "error"
                            ? "text-red-500"
                            : item.status === "uploading"
                            ? "text-gray-500"
                            : "text-gray-400"
                        }`}
                      >
                        {statusLabel[item.status]}
                      </span>

                      {item.status === "waiting" && !isBatchUploading && (
                        <button
                          onClick={() => handleRemoveBatchFile(index)}
                          className="cursor-pointer text-xs text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!batchDone ? (
                <button
                  onClick={() => handleBatchUpload()}
                  disabled={isBatchUploading}
                  className="mt-4 w-full cursor-pointer rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isBatchUploading
                    ? "순차 업로드 진행 중... (파일 사이 15초 대기)"
                    : `${batchFiles.length}개 파일 업로드 시작`}
                </button>
              ) : batchErrorCount > 0 ? (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => {
                      const failedIndexes = batchFiles
                        .map((f, idx) => (f.status === "error" ? idx : -1))
                        .filter((idx) => idx !== -1);
                      handleBatchUpload(failedIndexes);
                    }}
                    disabled={isBatchUploading}
                    className="w-full cursor-pointer rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {isBatchUploading
                      ? "재시도 중... (파일 사이 15초 대기)"
                      : `실패한 ${batchErrorCount}개 파일만 다시 시도`}
                  </button>

                  <button
                    onClick={() => router.push("/documents")}
                    disabled={isBatchUploading}
                    className="w-full cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    목록으로 이동
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/documents")}
                  className="mt-4 w-full cursor-pointer rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  목록으로 이동
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ 직접 입력 폼 ============ */}

      {method === "text" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              제목
            </label>
            <input
              type="text"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="예: 2026년 8월 사내 공지사항"
              disabled={isSubmittingText}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
            />
          </div>

          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              내용
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="AI가 검색할 내용을 입력하세요."
              disabled={isSubmittingText}
              rows={12}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
            />
            <div className="mt-1.5 text-right text-xs text-gray-400">
              {textContent.length.toLocaleString()}자
            </div>
          </div>

          <button
            onClick={handleSubmitText}
            disabled={isSubmittingText}
            className="w-full cursor-pointer rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmittingText ? "등록 및 분석 중..." : "정보 등록"}
          </button>

          {isSubmittingText && (
            <div className="mt-3 flex items-center rounded-lg bg-gray-50 p-3">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-black" />
              <span className="text-xs text-gray-600">
                청크 분할 · 임베딩 생성 중입니다.
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
