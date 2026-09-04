import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "평가는 관리자만 실행할 수 있습니다." },
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

    // 1. 골든셋 전체 가져오기
    const { data: goldenSet, error: gsError } = await supabaseAdmin
      .from("golden_set")
      .select("*");

    if (gsError || !goldenSet || goldenSet.length === 0) {
      return NextResponse.json(
        { success: false, error: "골든셋 데이터가 없습니다." },
        { status: 400 },
      );
    }

    const runBatch = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
      .slice(0, 19);
    const results = [];

    for (let i = 0; i < goldenSet.length; i++) {
      const item = goldenSet[i];

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      try {
        // =========================================
        // /api/chat과 완전히 동일한 검색+답변 로직
        // =========================================
        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-001",
          contents: item.question,
          config: { outputDimensionality: 768 },
        });

        const questionEmbedding = embedResponse.embeddings?.[0]?.values;

        const { data: matches } = await supabaseAdmin.rpc("match_chunks", {
          query_embedding: questionEmbedding,
          match_count: 5,
          match_threshold: 0.65,
        });

        let relevantChunks = matches || [];

        if (relevantChunks.length > 0) {
          const topDocumentId = relevantChunks[0].document_id;

          const { data: docInfo } = await supabaseAdmin
            .from("documents")
            .select("id, file_name, chunk_count")
            .eq("id", topDocumentId)
            .single();

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

        let actualAnswer = "";
        let sources: { id: string; fileName: string }[] = [];

        if (relevantChunks.length === 0) {
          actualAnswer =
            "등록된 문서에서 관련 내용을 찾지 못했습니다. 먼저 관련 문서를 업로드해주세요.";
        } else {
          const context = relevantChunks
            .map(
              (chunk: { file_name: string; content: string }, idx: number) =>
                `[참고 ${idx + 1} - ${chunk.file_name}]\n${chunk.content}`,
            )
            .join("\n\n");

          const prompt = `당신은 사내 규정 및 정책에 대해 답변하는 AI 어시스턴트입니다.
아래 "참고 문서" 내용만을 근거로 질문에 답변하세요.
참고 문서에 없는 내용은 추측하지 말고, 모른다고 답변하세요.
답변은 친절하고 명확하게, 한국어로 작성하세요.

[참고 문서]
${context}

[질문]
${item.question}

[답변]`;

          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
          });

          const responseText = response.text || "";

          // Gemini API가 에러를 텍스트 형태로 반환하는 경우 감지
          if (
            responseText.includes('"status":"UNAVAILABLE"') ||
            responseText.includes('"code":503')
          ) {
            throw new Error("AI 서버 일시 장애 (503) - 재시도 필요");
          }

          actualAnswer = responseText;

          const sourceMap = new Map<string, { id: string; fileName: string }>();
          relevantChunks.forEach(
            (chunk: { document_id: string; file_name: string }) => {
              if (!sourceMap.has(chunk.document_id)) {
                sourceMap.set(chunk.document_id, {
                  id: chunk.document_id,
                  fileName: chunk.file_name,
                });
              }
            },
          );
          sources = Array.from(sourceMap.values());
        }

        // ⚠️ 주의: 평가용 질문은 chat_history에 저장하지 않음
        // (실제 임직원 통계/대시보드가 오염되지 않도록)

        // =========================================
        // LLM 채점 (실제 답변 vs 정답 비교)
        // =========================================
        const judgePrompt = `당신은 RAG 시스템의 답변 품질을 채점하는 평가자입니다.

질문: ${item.question}
정답(기준): ${item.expected_answer}
실제 답변: ${actualAnswer}

실제 답변이 정답의 핵심 내용을 얼마나 정확하게 포함하고 있는지 0~100점으로 채점하세요.
- 핵심 사실(숫자, 날짜, 이름 등)이 틀리면 크게 감점
- 표현 방식이 달라도 의미가 같으면 감점하지 않음
- 정답에 없는 내용을 지어냈으면 감점

반드시 아래 JSON 형식으로만 답하세요:
{"score": 숫자, "reason": "채점 이유 한 문장"}`;

        const judgeResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: judgePrompt,
        });

        let score = 0;
        let reason = "채점 실패";

        try {
          const judgeText = (judgeResponse.text || "")
            .replace(/```json|```/g, "")
            .trim();
          const parsed = JSON.parse(judgeText);
          score = parsed.score ?? 0;
          reason = parsed.reason ?? "";
        } catch {
          reason = "채점 결과 파싱 실패";
        }

        await supabaseAdmin.from("eval_runs").insert({
          golden_set_id: item.id,
          actual_answer: actualAnswer,
          actual_sources: sources,
          score,
          score_reason: reason,
          run_batch: runBatch,
        });

        results.push({
          question: item.question,
          score,
          reason,
          success: true,
        });
      } catch (itemError) {
        results.push({
          question: item.question,
          score: 0,
          reason: itemError instanceof Error ? itemError.message : "처리 실패",
          success: false,
        });
      }
    }

    const successfulResults = results.filter((r) => r.success);

    const avgScore =
      successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.score, 0) /
          successfulResults.length
        : 0;

    return NextResponse.json({
      success: true,
      runBatch,
      avgScore: Math.round(avgScore),
      results,
    });
  } catch (error) {
    console.error("Eval Run Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "평가 실행 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
