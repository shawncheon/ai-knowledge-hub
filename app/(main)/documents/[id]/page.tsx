"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useDocumentDownload } from "@/hooks/useDocumentDownload";

interface DocumentDetail {
  id: string;
  fileName: string;
  fileSize: number;
  chunkCount: number;
  createdAt: string;
  textPreview: string;
  hasFile: boolean;
}

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { user, isLoading: isLoadingUser } = useUser();
  const { downloadingId, handleDownload } = useDocumentDownload();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadDetail = async () => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setDocument(data.document);
        setEditTitle(data.document.fileName);
        setEditContent(data.document.textPreview);
      } else {
        alert(data.error || "문서 정보를 불러오지 못했습니다.");
        router.push("/documents");
      }
    } catch (error) {
      console.error("문서 상세 조회 실패:", error);
      alert("문서 정보를 불러오지 못했습니다.");
      router.push("/documents");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (!document) return;

    const confirmed = window.confirm(
      `"${document.fileName}" 문서를 삭제하시겠습니까?\n삭제하면 AI 검색에서도 더 이상 참조되지 않습니다.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "문서 삭제에 실패했습니다.");
      }

      router.push("/documents");
    } catch (error) {
      console.error("Delete Error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "문서 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartEdit = () => {
    if (!document) return;
    setEditTitle(document.fileName);
    setEditContent(document.textPreview);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!editContent.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "수정에 실패했습니다.");
      }

      alert("정보가 수정되었습니다.");
      setIsEditing(false);
      await loadDetail();
    } catch (error) {
      console.error("Update Error:", error);
      alert(
        error instanceof Error ? error.message : "수정 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
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
      <button
        onClick={() => router.push("/documents")}
        className="mb-6 flex cursor-pointer items-center text-sm text-gray-500 hover:text-black"
      >
        ← 목록으로
      </button>

      {isLoadingDetail ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-sm text-gray-400">
          불러오는 중...
        </div>
      ) : document ? (
        <>
          {isEditing ? (
            /* ============ 수정 모드 ============ */
            <>
              <div className="mb-8">
                <div className="mb-2 text-sm font-medium text-gray-400">
                  EDIT INFORMATION
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  정보 수정
                </h1>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-8">
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    제목
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                </div>

                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    내용
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    disabled={isSaving}
                    rows={14}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-black disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                  <div className="mt-1.5 text-right text-xs text-gray-400">
                    {editContent.length.toLocaleString()}자
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 cursor-pointer rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {isSaving ? "저장 및 재분석 중..." : "저장"}
                  </button>

                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="cursor-pointer rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                </div>

                {isSaving && (
                  <div className="mt-3 flex items-center rounded-lg bg-gray-50 p-3">
                    <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-black" />
                    <span className="text-xs text-gray-600">
                      청크 재분할 · 임베딩 재생성 중입니다.
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ============ 조회 모드 ============ */
            <>
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-400">
                    DOCUMENT DETAIL
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight">
                    {document.fileName}
                  </h1>

                  <p className="mt-2 text-sm text-gray-500">
                    {(document.fileSize / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {document.chunkCount} chunks ·{" "}
                    {new Date(document.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {document.hasFile && (
                    <button
                      onClick={() =>
                        handleDownload(document.id, document.fileName)
                      }
                      disabled={downloadingId === document.id}
                      className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                    >
                      다운로드
                    </button>
                  )}

                  {!document.hasFile && user?.role === "admin" && (
                    <button
                      onClick={handleStartEdit}
                      className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      수정
                    </button>
                  )}

                  {user?.role === "admin" && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? "삭제 중..." : "삭제"}
                    </button>
                  )}
                </div>
              </div>

              <section>
                <div className="mb-3 text-sm font-semibold">
                  {document.hasFile ? "추출된 텍스트 (미리보기)" : "내용"}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="max-h-[500px] overflow-y-auto rounded-xl bg-gray-50 p-5">
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                      {document.textPreview || "미리볼 텍스트가 없습니다."}
                    </pre>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center text-sm text-gray-400">
          문서 정보를 불러오지 못했습니다.
        </div>
      )}
    </>
  );
}
