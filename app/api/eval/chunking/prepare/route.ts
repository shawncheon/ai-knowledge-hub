import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

// VARIANTS는 이제 고정값이 아니라, 요청받은 값으로 동적으로 만듭니다

function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 화면에서 입력받은 값 사용
    const body = await req.json();

    const variantA = {
      name: `A_${body.chunkSizeA}자_overlap${body.overlapA}`,
      chunkSize: Number(body.chunkSizeA),
      overlap: Number(body.overlapA),
    };
    const variantB = {
      name: `B_${body.chunkSizeB}자_overlap${body.overlapB}`,
      chunkSize: Number(body.chunkSizeB),
      overlap: Number(body.overlapB),
    };

    // 값 검증
    for (const v of [variantA, variantB]) {
      if (!v.chunkSize || v.chunkSize < 50 || v.chunkSize > 5000) {
        return NextResponse.json(
          { success: false, error: "청크 크기는 50~5000자 사이여야 합니다." },
          { status: 400 },
        );
      }
      if (v.overlap < 0 || v.overlap >= v.chunkSize) {
        return NextResponse.json(
          {
            success: false,
            error: "오버랩은 0 이상, 청크 크기보다 작아야 합니다.",
          },
          { status: 400 },
        );
      }
    }

    const VARIANTS = [variantA, variantB];

    // 기존 실험 데이터 초기화 (재실행 대비)
    await supabaseAdmin
      .from("document_chunks_experiment")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, full_text");

    if (docError || !documents || documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "등록된 문서가 없습니다." },
        { status: 400 },
      );
    }

    let totalChunks = 0;

    for (const doc of documents) {
      if (!doc.full_text || doc.full_text.trim().length === 0) continue;

      for (const variant of VARIANTS) {
        const chunks = splitIntoChunks(
          doc.full_text,
          variant.chunkSize,
          variant.overlap,
        );
        if (chunks.length === 0) continue;

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-001",
          contents: chunks,
          config: { outputDimensionality: 768 },
        });

        const embeddings = embedResponse.embeddings || [];

        const rows = chunks.map((content, index) => ({
          document_id: doc.id,
          variant: variant.name,
          content,
          chunk_index: index,
          embedding: embeddings[index]?.values,
        }));

        await supabaseAdmin.from("document_chunks_experiment").insert(rows);
        totalChunks += rows.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${documents.length}개 문서를 ${VARIANTS.length}가지 방식으로 재청킹했습니다.`,
      totalChunks,
      variants: VARIANTS.map((v) => v.name),
    });
  } catch (error) {
    console.error("Chunking Prepare Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "준비 작업 실패",
      },
      { status: 500 },
    );
  }
}
