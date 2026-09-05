import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const VARIANT_NAMES: string[] = body.variantNames;

    if (!VARIANT_NAMES || VARIANT_NAMES.length !== 2) {
      return NextResponse.json(
        { success: false, error: "비교할 방식 이름 2개가 필요합니다." },
        { status: 400 },
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

    const { data: goldenSet } = await supabaseAdmin
      .from("golden_set")
      .select("*");

    if (!goldenSet || goldenSet.length === 0) {
      return NextResponse.json(
        { success: false, error: "골든셋 데이터가 없습니다." },
        { status: 400 },
      );
    }

    const runBatch = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
      .slice(0, 19);

    const variantResults: Record<
      string,
      { score: number; question: string; reason: string }[]
    > = {};

    for (const variant of VARIANT_NAMES) {
      variantResults[variant] = [];

      for (const item of goldenSet) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        try {
          const embedResponse = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: item.question,
            config: { outputDimensionality: 768 },
          });

          const questionEmbedding = embedResponse.embeddings?.[0]?.values;

          const { data: matches } = await supabaseAdmin.rpc(
            "match_chunks_experiment",
            {
              query_embedding: questionEmbedding,
              target_variant: variant,
              match_count: 5,
              match_threshold: 0.65,
            },
          );

          const relevantChunks = matches || [];

          let actualAnswer = "";

          if (relevantChunks.length === 0) {
            actualAnswer = "등록된 문서에서 관련 내용을 찾지 못했습니다.";
          } else {
            const context = relevantChunks
              .map(
                (c: { file_name: string; content: string }, i: number) =>
                  `[참고 ${i + 1} - ${c.file_name}]\n${c.content}`,
              )
              .join("\n\n");

            const prompt = `당신은 사내 규정 및 정책에 대해 답변하는 AI 어시스턴트입니다.
아래 "참고 문서" 내용만을 근거로 질문에 답변하세요.
참고 문서에 없는 내용은 추측하지 말고, 모른다고 답변하세요.

[참고 문서]
${context}

[질문]
${item.question}

[답변]`;

            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: prompt,
            });

            actualAnswer = response.text || "";
          }

          // 답변 생성과 채점 사이에도 대기 (Flash Lite 연속 호출 방지)
          await new Promise((resolve) => setTimeout(resolve, 5000));

          const judgePrompt = `질문: ${item.question}
정답(기준): ${item.expected_answer}
실제 답변: ${actualAnswer}

실제 답변이 정답의 핵심 내용을 얼마나 정확하게 포함하고 있는지 0~100점으로 채점하세요.
반드시 아래 JSON 형식으로만 답하세요:
{"score": 숫자, "reason": "채점 이유 한 문장"}`;

          const judgeResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: judgePrompt,
          });

          let score = 0;
          let reason = "채점 실패";

          try {
            const parsed = JSON.parse(
              (judgeResponse.text || "").replace(/```json|```/g, "").trim(),
            );
            score = parsed.score ?? 0;
            reason = parsed.reason ?? "";
          } catch {
            reason = "채점 파싱 실패";
          }

          await supabaseAdmin.from("chunking_experiment_runs").insert({
            variant,
            golden_set_id: item.id,
            actual_answer: actualAnswer,
            score,
            score_reason: reason,
            run_batch: runBatch,
          });

          variantResults[variant].push({
            question: item.question,
            score,
            reason,
          });
        } catch (itemError) {
          variantResults[variant].push({
            question: item.question,
            score: 0,
            reason: itemError instanceof Error ? itemError.message : "실패",
          });
        }
      }
    }

    const summary = VARIANT_NAMES.map((variant) => {
      const results = variantResults[variant];
      const avg = Math.round(
        results.reduce((sum, r) => sum + r.score, 0) / results.length,
      );
      return { variant, avgScore: avg, results };
    });

    return NextResponse.json({ success: true, runBatch, summary });
  } catch (error) {
    console.error("Chunking Experiment Run Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "실험 실행 실패",
      },
      { status: 500 },
    );
  }
}
