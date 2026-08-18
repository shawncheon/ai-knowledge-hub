import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    // 현재 로그인한 사용자 확인
    const cookieStore = await cookies();

    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user: authUser },
    } = await supabaseServer.auth.getUser();

    const { question } = await req.json();

    if (!question) {
      return NextResponse.json(
        { error: "질문을 입력해주세요." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // =========================================
    // 1. 질문을 임베딩으로 변환
    // =========================================
    const embedResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
      config: {
        outputDimensionality: 768,
      },
    });

    const questionEmbedding = embedResponse.embeddings?.[0]?.values;

    if (!questionEmbedding) {
      throw new Error("질문 임베딩 생성에 실패했습니다.");
    }

 // =========================================
    // 2. Supabase에서 관련 문서 조각 검색
    // =========================================
    const { data: matches, error: searchError } = await supabaseAdmin.rpc(
      "match_chunks",
      {
        query_embedding: questionEmbedding,
        match_count: 5,
        match_threshold: 0.65,
      }
    );

    if (searchError) {
      throw new Error(searchError.message);
    }

    let relevantChunks = matches || [];

    // =========================================
    // 2-1. 검색된 문서가 규모가 작으면(예: 스프레드시트)
    // 상위 몇 개만이 아니라 그 문서 전체를 근거로 사용
    // (부분 조회로 답이 잘리는 것을 방지)
    // =========================================
    if (relevantChunks.length > 0) {
      const topDocumentId = relevantChunks[0].document_id;

      const { data: docInfo } = await supabaseAdmin
        .from("documents")
        .select("id, file_name, chunk_count")
        .eq("id", topDocumentId)
        .single();

      // 문서 전체 청크가 100개 이하로 작으면, 그 문서의 모든 청크를 사용
      if (docInfo && docInfo.chunk_count <= 100) {
        const { data: allChunks } = await supabaseAdmin
          .from("document_chunks")
          .select("id, document_id, content, chunk_index")
          .eq("document_id", topDocumentId)
          .order("chunk_index", { ascending: true });

        if (allChunks && allChunks.length > 0) {
          relevantChunks = allChunks.map((c) => ({
            ...c,
            file_name: docInfo.file_name,
          }));
        }
      }
    }
    // =========================================
    // 3. 검색된 문서가 없는 경우
    // =========================================
    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer:
          "등록된 문서에서 관련 내용을 찾지 못했습니다. 먼저 관련 문서를 업로드해주세요.",
        sources: [],
      });
    }

    // =========================================
    // 4. 검색된 조각들을 컨텍스트로 구성
    // =========================================
    const context = relevantChunks
      .map(
        (chunk: { file_name: string; content: string }, index: number) =>
          `[참고 ${index + 1} - ${chunk.file_name}]\n${chunk.content}`
      )
      .join("\n\n");

    const prompt = `당신은 사내 규정 및 정책에 대해 답변하는 AI 어시스턴트입니다.
아래 "참고 문서" 내용만을 근거로 질문에 답변하세요.
참고 문서에 없는 내용은 추측하지 말고, 모른다고 답변하세요.
답변은 친절하고 명확하게, 한국어로 작성하세요.

[참고 문서]
${context}

[질문]
${question}

[답변]`;

    // =========================================
    // 5. Gemini로 최종 답변 생성
    // =========================================
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });

// =========================================
    // 6. 참고 문서 목록 (중복 제거, document_id 포함)
    // =========================================
const sourceMap = new Map<string, { id: string; fileName: string }>();

    relevantChunks.forEach(
      (chunk: { document_id: string; file_name: string }) => {
        if (!sourceMap.has(chunk.document_id)) {
          sourceMap.set(chunk.document_id, {
            id: chunk.document_id,
            fileName: chunk.file_name,
          });
        }
      }
    );

    const sources = Array.from(sourceMap.values());

// =========================================
    // 7. 대화 기록 저장 (실패해도 답변 자체는 정상 반환)
    // =========================================
const { error: historyError } = await supabaseAdmin
      .from("chat_history")
      .insert({
        question,
        answer: response.text,
        sources,
        user_id: authUser?.id || null,
      });

    if (historyError) {
      console.error("History Save Error:", historyError);
    }

    return NextResponse.json({
      answer: response.text,
      sources,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}