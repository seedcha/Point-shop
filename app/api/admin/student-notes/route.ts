import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const requestedDepartmentId = new URL(request.url).searchParams.get("departmentId")?.trim();
  let query = supabaseAdmin.from("students").select("id, note");

  if (admin.profile.role !== "master") {
    query = query.eq("department_id", admin.profile.department_id);
  } else if (requestedDepartmentId) {
    query = query.eq("department_id", requestedDepartmentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "비고를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    notes: Object.fromEntries((data ?? []).map((student) => [student.id, student.note ?? ""])),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { studentId?: string; note?: string; departmentId?: string };
  const studentId = body.studentId?.trim();
  const note = body.note?.trim() ?? "";
  const requestedDepartmentId = body.departmentId?.trim();

  if (!studentId) {
    return NextResponse.json({ error: "학생을 선택해주세요." }, { status: 400 });
  }

  const targetDepartmentId =
    admin.profile.role === "master" ? requestedDepartmentId : admin.profile.department_id;

  if (!targetDepartmentId) {
    return NextResponse.json({ error: "가맹점을 선택해주세요." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, department_id")
    .eq("id", studentId)
    .single();

  if (studentError || !student || student.department_id !== targetDepartmentId) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("students")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", studentId)
    .eq("department_id", targetDepartmentId);

  if (error) {
    return NextResponse.json({ error: "비고를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
