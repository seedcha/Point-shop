import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type StudentInput = {
  name?: string;
  grade?: string;
  parent_phone?: string;
};

type AdminProfile = {
  id: string;
  role: "master" | "manager" | "staff";
  department_id: string | null;
  is_active: boolean;
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
    .single<AdminProfile>();

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

function assertCanMutateStudents(profile: AdminProfile) {
  if (profile.role === "staff") {
    return { error: "학생 관리 권한이 없습니다.", status: 403 as const };
  }

  if (profile.role !== "master" && !profile.department_id) {
    return { error: "관리자 지점 정보가 없습니다.", status: 400 as const };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const permissionError = assertCanMutateStudents(admin.profile);

  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const body = (await request.json()) as { departmentId?: string; students?: StudentInput[] };
  const departmentId =
    admin.profile.role === "master"
      ? body.departmentId?.trim() ?? admin.profile.department_id
      : admin.profile.department_id;
  const students = (body.students ?? [])
    .map(normalizeStudent)
    .filter(Boolean)
    .map((student) => ({
      ...student,
      department_id: departmentId,
      teacher_id: admin.profile.id,
    }));

  if (!departmentId) {
    return NextResponse.json({ error: "학생을 추가할 지점을 선택해주세요." }, { status: 400 });
  }

  if (!students.length) {
    return NextResponse.json({ error: "추가할 학생 정보가 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .insert(students)
    .select("id, department_id, teacher_id, parent_phone, name, grade, points, note, is_active, created_at");

  if (error) {
    return NextResponse.json({ error: "학생을 추가하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ students: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const permissionError = assertCanMutateStudents(admin.profile);

  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const body = (await request.json()) as { studentIds?: string[]; isActive?: boolean };
  const studentIds = body.studentIds ?? [];

  if (!studentIds.length) {
    return NextResponse.json({ error: "상태를 변경할 학생을 선택해주세요." }, { status: 400 });
  }

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "변경할 학생 상태를 확인해주세요." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("students")
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .in("id", studentIds);

  if (admin.profile.role !== "master") {
    query = query.eq("department_id", admin.profile.department_id);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: "학생 상태를 변경하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const permissionError = assertCanMutateStudents(admin.profile);

  if (permissionError) {
    return NextResponse.json({ error: permissionError.error }, { status: permissionError.status });
  }

  const body = (await request.json()) as { studentIds?: string[]; hardDelete?: boolean };
  const studentIds = body.studentIds ?? [];

  if (!studentIds.length) {
    return NextResponse.json({ error: "삭제할 학생을 선택해주세요." }, { status: 400 });
  }

  if (!body.hardDelete) {
    return NextResponse.json({ error: "학생 완전 삭제 옵션을 확인해주세요." }, { status: 400 });
  }

  let query = supabaseAdmin.from("students").delete().in("id", studentIds);

  if (admin.profile.role !== "master") {
    query = query.eq("department_id", admin.profile.department_id);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: "학생을 완전히 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
