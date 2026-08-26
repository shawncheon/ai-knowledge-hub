import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

// =========================================
// GET: 전체 임직원 목록 조회
// =========================================
export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      users: data,
    });
  } catch (error) {
    console.error("User List Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "임직원 목록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

// =========================================
// POST: 새 임직원 계정 생성
// =========================================
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const { email, name, role, password } = await req.json();

    const trimmedEmail = (email || "").trim();
    const trimmedName = (name || "").trim();
    const selectedRole = role === "admin" ? "admin" : "employee";

    if (!trimmedEmail) {
      return NextResponse.json(
        { success: false, error: "이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    if (!trimmedName) {
      return NextResponse.json(
        { success: false, error: "이름을 입력해주세요." },
        { status: 400 },
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "초기 비밀번호는 6자 이상이어야 합니다.",
        },
        { status: 400 },
      );
    }

    // 1. Supabase Auth 계정 생성 (이메일 인증 절차 생략)
    const { data: newAuthUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
      });

    if (createError || !newAuthUser.user) {
      const message = createError?.message.includes("already been registered")
        ? "이미 등록된 이메일입니다."
        : createError?.message || "계정 생성에 실패했습니다.";

      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    // 2. users 테이블에 role 정보 등록
    const { data: userRow, error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: newAuthUser.user.id,
        email: trimmedEmail,
        name: trimmedName,
        role: selectedRole,
      })
      .select()
      .single();

    if (userInsertError || !userRow) {
      // 롤백: users 테이블 저장 실패 시 Auth 계정도 삭제
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);

      throw new Error(
        userInsertError?.message || "사용자 정보 저장에 실패했습니다.",
      );
    }

    return NextResponse.json({
      success: true,
      user: userRow,
      message: "임직원 계정이 생성되었습니다.",
    });
  } catch (error) {
    console.error("User Create Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "계정 생성 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
