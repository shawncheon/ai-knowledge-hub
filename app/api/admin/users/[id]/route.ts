import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/require-admin";

// =========================================
// PATCH: 임직원 권한(role) 변경
// =========================================
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const { role, name, email } = await req.json();

    const updates: { role?: string; name?: string; email?: string } = {};

    // =========================================
    // 권한 변경
    // =========================================
    if (role !== undefined) {
      if (role !== "admin" && role !== "employee") {
        return NextResponse.json(
          { success: false, error: "올바르지 않은 권한 값입니다." },
          { status: 400 },
        );
      }

      if (id === admin.id && role !== "admin") {
        return NextResponse.json(
          {
            success: false,
            error: "본인 계정의 권한은 스스로 낮출 수 없습니다.",
          },
          { status: 400 },
        );
      }

      updates.role = role;
    }

    // =========================================
    // 이름 변경
    // =========================================
    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return NextResponse.json(
          { success: false, error: "이름을 입력해주세요." },
          { status: 400 },
        );
      }

      updates.name = trimmedName;
    }

    // =========================================
    // 이메일 변경 (Auth 계정 + users 테이블 둘 다 갱신)
    // =========================================
    if (email !== undefined) {
      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        return NextResponse.json(
          { success: false, error: "이메일을 입력해주세요." },
          { status: 400 },
        );
      }

      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          email: trimmedEmail,
          email_confirm: true,
        });

      if (authUpdateError) {
        const message = authUpdateError.message.includes(
          "already been registered",
        )
          ? "이미 사용 중인 이메일입니다."
          : authUpdateError.message;

        return NextResponse.json(
          { success: false, error: message },
          { status: 400 },
        );
      }

      updates.email = trimmedEmail;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "변경할 내용이 없습니다." },
        { status: 400 },
      );
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !updatedUser) {
      throw new Error(error?.message || "정보 변경에 실패했습니다.");
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "정보가 변경되었습니다.",
    });
  } catch (error) {
    console.error("User Update Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "정보 변경 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

// =========================================
// DELETE: 임직원 계정 삭제
// =========================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    const { id } = await params;

    if (id === admin.id) {
      return NextResponse.json(
        { success: false, error: "본인 계정은 삭제할 수 없습니다." },
        { status: 400 },
      );
    }

    // Auth 계정 삭제 (users 테이블은 on delete cascade로 자동 삭제됨)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      message: "계정이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("User Delete Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "계정 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
