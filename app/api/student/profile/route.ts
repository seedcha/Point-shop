import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const studentId = new URL(request.url).searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "학생 정보가 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, department_id, name, parent_phone, grade, points, created_at")
    .eq("id", studentId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "학생 정보를 불러오지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ student: data });
}
