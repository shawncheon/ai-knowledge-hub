"use client";

export interface SourceItem {
  id: string;
  fileName: string;
}

export interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  sources: SourceItem[];
  created_at: string;
}

interface HistoryDetailModalProps {
  item: HistoryItem | null;
  onClose: () => void;
  onDownload: (id: string, fileName: string) => void;
  downloadingId: string | null;
  onContinue?: (item: HistoryItem) => void;
}

export default function HistoryDetailModal({
  item,
  onClose,
  onDownload,
  downloadingId,
  onContinue,
}: HistoryDetailModalProps) {
  if (!item) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400">
              {new Date(item.created_at).toLocaleString("ko-KR")}
            </div>
            <h2 className="mt-1 text-lg font-bold">{item.question}</h2>
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-[15px] leading-7 text-gray-700">
          {item.answer}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            참고 문서
          </div>

          {item.sources && item.sources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => onDownload(source.id, source.fileName)}
                  disabled={downloadingId === source.id}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📄 {source.fileName}
                  <span className="text-gray-400">↓</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              참고한 문서가 없습니다.
            </div>
          )}
        </div>

        {onContinue && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <button
              onClick={() => onContinue(item)}
              className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-black"
            >
              AI Search에서 이어서 질문하기 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
