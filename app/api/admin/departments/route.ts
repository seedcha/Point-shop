import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

async function getMasterProfile(request: NextRequest) {
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
    .select("id, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profile || profile.role !== "master") {
    return { error: "마스터 관리자만 사용할 수 있습니다.", status: 403 as const };
  }

  return { profile };
}

export async function POST(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "가맹점명은 1~50자로 입력해주세요." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "가맹점 정보를 확인하지 못했습니다." }, { status: 500 });
  }

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: "가맹점을 활성화하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ department: data });
  }

  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: "가맹점을 추가하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ department: data });
}

export async function DELETE(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const departmentId = new URL(request.url).searchParams.get("departmentId");

  if (!departmentId) {
    return NextResponse.json({ error: "삭제할 가맹점을 선택해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("departments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", departmentId);

  if (error) {
    return NextResponse.json({ error: "가맹점을 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
