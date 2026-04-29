import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const NOTE_PREFIX = "student_note:";

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
    .single();

  if (profileError || !profile) {
    return { error: "관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  return { profile };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("setting_key, value")
    .like("setting_key", `${NOTE_PREFIX}%`);

  if (error) {
    return NextResponse.json({ error: "비고를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    notes: Object.fromEntries(
      (data ?? []).map((row) => [row.setting_key.replace(NOTE_PREFIX, ""), row.value])
    ),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { studentId?: string; note?: string };
  const studentId = body.studentId?.trim();
  const note = body.note?.trim() ?? "";

  if (!studentId) {
    return NextResponse.json({ error: "학생을 선택해주세요." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, department_id")
    .eq("id", studentId)
    .single();

  if (studentError || !student || student.department_id !== admin.profile.department_id) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("admin_settings").upsert({
    setting_key: `${NOTE_PREFIX}${studentId}`,
    value: note,
    updated_by: admin.profile.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "비고를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
