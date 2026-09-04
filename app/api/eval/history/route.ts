import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const { data: runs, error } = await supabaseAdmin
      .from("eval_runs")
      .select("run_batch, score")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const grouped = new Map<string, { total: number; count: number }>();

    (runs || []).forEach((r) => {
      const existing = grouped.get(r.run_batch) || { total: 0, count: 0 };
      existing.total += r.score;
      existing.count += 1;
      grouped.set(r.run_batch, existing);
    });

    const history = Array.from(grouped.entries())
      .map(([runBatch, { total, count }]) => ({
        runBatch,
        avgScore: Math.round(total / count),
        questionCount: count,
      }))
      .sort((a, b) => (a.runBatch < b.runBatch ? 1 : -1));

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Eval History Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "이력 조회에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
