import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const PRODUCT_IMAGE_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

type AdminProfile = {
  id: string;
  role: string;
  department_id: string | null;
};

async function getAdminProfile(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return { error: "인증 정보가 없습니다.", status: 401 as const };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "로그인이 필요합니다.", status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, role, department_id")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single<AdminProfile>();

  if (profileError || !profile || !["master", "manager"].includes(profile.role)) {
    return { error: "상품 이미지 업로드 권한이 없습니다.", status: 403 as const };
  }

  return { profile };
}

function getExtension(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase();

  if (byName && /^[a-z0-9]+$/.test(byName)) {
    return byName;
  }

  return file.type.split("/")[1]?.toLowerCase() || "png";
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 이미지를 선택해주세요." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "이미지는 2MB 이하로 업로드해주세요." }, { status: 400 });
  }

  const extension = getExtension(file);
  const departmentPath = admin.profile.department_id ?? "master";
  const filePath = `${departmentPath}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "상품 이미지를 업로드하지 못했습니다." }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filePath);

  return NextResponse.json({ imageUrl: data.publicUrl });
}
