import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile, resolveAdminDepartment } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "achievement-images";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const formData = await request.formData();
  const departmentId = String(formData.get("departmentId") ?? "");
  const achievementId = String(formData.get("achievementId") ?? "");
  const file = formData.get("file");
  const scope = await resolveAdminDepartment(admin.profile, departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (!(file instanceof File) || !achievementId) {
    return NextResponse.json({ error: "칭호 이미지 파일을 선택해주세요." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "PNG, JPEG, WebP 이미지를 2MB 이하로 업로드해주세요." },
      { status: 400 }
    );
  }

  const { data: achievement } = await supabaseAdmin
    .from("achievements")
    .select("id")
    .eq("id", achievementId)
    .eq("department_id", scope.departmentId)
    .maybeSingle();

  if (!achievement) {
    return NextResponse.json({ error: "칭호를 찾을 수 없습니다." }, { status: 404 });
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filePath = `${scope.departmentId}/${achievementId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "칭호 이미지를 업로드하지 못했습니다." }, { status: 500 });
  }

  const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
  const { error: updateError } = await supabaseAdmin
    .from("achievements")
    .update({ image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", achievementId)
    .eq("department_id", scope.departmentId);

  if (updateError) {
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: "칭호 이미지를 연결하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl.publicUrl });
}
