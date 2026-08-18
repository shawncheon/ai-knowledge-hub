import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // 읽기 전용이라 여기선 아무것도 안 함
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: userRow, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role")
      .eq("id", user.id)
      .single();

    if (error || !userRow) {
      return NextResponse.json(
        { success: false, error: "사용자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userRow,
    });
  } catch (error) {
    console.error("Me API Error:", error);

    return NextResponse.json(
      { success: false, error: "사용자 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}