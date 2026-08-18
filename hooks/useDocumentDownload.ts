"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function useDocumentDownload() {
  const router = useRouter();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (id: string, fileName: string) => {
    const lowerName = fileName.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");

    // 팝업 차단 방지: 클릭 즉시(비동기 작업 전에) 빈 탭을 먼저 열어둔다
    const newTab = isPdf ? window.open("", "_blank") : null;

    setDownloadingId(id);

    try {
      const response = await fetch(`/api/documents/${id}/download`);
      const data = await response.json();

      // 문서는 있지만 원본 파일이 없는 경우 (직접 입력으로 등록된 정보)
      // → 다운로드 대신 해당 정보의 상세 화면으로 이동
      if (data.noFile) {
        if (newTab) {
          newTab.close();
        }
        router.push(`/documents/${id}`);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "다운로드 링크 생성에 실패했습니다.");
      }

      if (isPdf) {
        if (newTab) {
          newTab.location.href = data.url;
        } else {
          window.open(data.url, "_blank");
        }
      } else {
        const link = document.createElement("a");
        link.href = data.url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Download Error:", error);

      if (newTab) {
        newTab.close();
      }

      alert(
        error instanceof Error
          ? error.message
          : "다운로드 중 오류가 발생했습니다."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return { downloadingId, handleDownload };
}