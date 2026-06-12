import { NextRequest, NextResponse } from "next/server";

import {
  createStudentSessionToken,
  studentSessionCookie,
  verifyStudentSelectionToken,
} from "@/lib/student-session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const selection = body?.token ? verifyStudentSelectionToken(body.token) : null;

  if (!selection) {
    return NextResponse.json({ error: "학생 로그인 정보가 만료되었습니다." }, { status: 401 });
  }

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id, department_id")
    .eq("id", selection.studentId)
    .eq("department_id", selection.departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !student) {
    return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const response = NextResponse.json({ studentId: student.id });
  response.cookies.set({
    name: studentSessionCookie.name,
    value: createStudentSessionToken(student.id, student.department_id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: studentSessionCookie.maxAge,
  });
  return response;
}
