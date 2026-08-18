import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
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

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError || !userRow) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const isAdmin = userRow.role === "admin";

    let query = supabaseAdmin
      .from("chat_history")
      .select("id, question, answer, sources, created_at")
      .order("created_at", { ascending: false })
      .limit(isAdmin ? 200 : 50);

    if (!isAdmin) {
      query = query.eq("user_id", authUser.id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      history: data,
      scope: isAdmin ? "all" : "mine",
    });
  } catch (error) {
    console.error("History Fetch Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "히스토리를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}