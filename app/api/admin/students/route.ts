import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type StudentInput = {
  name?: string;
  grade?: string;
  parent_phone?: string;
};

const GRADE_OPTIONS = [
  "3세",
  "4세",
  "5세",
  "6세",
  "7세",
  "초1",
  "초2",
  "초3",
  "초4",
  "초5",
  "초6",
  "중1",
  "중2",
  "중3",
  "고1",
  "고2",
  "고3",
  "성인",
];

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
    .select("id, role, department_id, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profile) {
    return { error: "활성화된 관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  return { profile };
}

function normalizeStudent(input: StudentInput) {
  const name = input.name?.trim();
  const grade = input.grade?.trim();
  const parentPhone = input.parent_phone?.trim();

  if (!name || !grade || !parentPhone || !GRADE_OPTIONS.includes(grade)) {
    return null;
  }

  return {
    name,
    grade,
    parent_phone: parentPhone,
  };
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (admin.profile.role === "staff") {
    return NextResponse.json({ error: "학생 추가 권한이 없습니다." }, { status: 403 });
  }

  const body = (await request.json()) as { students?: StudentInput[] };
  const students = (body.students ?? [])
    .map(normalizeStudent)
    .filter(Boolean)
    .map((student) => ({
      ...student,
      department_id: admin.profile.department_id,
      teacher_id: admin.profile.id,
    }));

  if (!students.length) {
    return NextResponse.json({ error: "추가할 학생 정보가 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .insert(students)
    .select("id, department_id, teacher_id, parent_phone, name, grade, points, is_active, created_at");

  if (error) {
    return NextResponse.json({ error: "학생을 추가하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ students: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (admin.profile.role === "staff") {
    return NextResponse.json({ error: "학생 삭제 권한이 없습니다." }, { status: 403 });
  }

  const body = (await request.json()) as { studentIds?: string[] };
  const studentIds = body.studentIds ?? [];

  if (!studentIds.length) {
    return NextResponse.json({ error: "삭제할 학생을 선택해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("students")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", studentIds);

  if (error) {
    return NextResponse.json({ error: "학생을 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
