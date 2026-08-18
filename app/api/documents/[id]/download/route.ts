import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

const { data: documentRow, error: docError } = await supabaseAdmin
      .from("documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();

    if (docError || !documentRow) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 문서는 있지만 원본 파일이 없는 경우 (직접 입력으로 등록된 정보)
    if (!documentRow.storage_path) {
      return NextResponse.json({
        success: false,
        noFile: true,
        error: "원본 파일이 없습니다.",
      });
    }

    const fileName = documentRow.file_name;
    const isPdf = fileName.toLowerCase().endsWith(".pdf");

    // 60초 동안만 유효한 다운로드 URL 발급
    // PDF는 브라우저에서 바로 보이게, 그 외(Excel 등)는 강제 다운로드되게 발급
    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("documents")
        .createSignedUrl(
          documentRow.storage_path,
          60,
          isPdf ? undefined : { download: fileName }
        );

    if (signedUrlError || !signedUrlData) {
      throw new Error(
        signedUrlError?.message || "다운로드 링크 생성에 실패했습니다."
      );
    }

    return NextResponse.json({
      success: true,
      url: signedUrlData.signedUrl,
      fileName: documentRow.file_name,
    });
  } catch (error) {
    console.error("Download URL Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "다운로드 링크 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}