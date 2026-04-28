import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { phone?: string };
  const inputPhone = digitsOnly(body.phone ?? "");

  if (inputPhone.length < 8) {
    return NextResponse.json({ error: "전화번호를 확인해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, name, parent_phone, grade, points")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: "학생 정보를 확인하지 못했습니다." }, { status: 500 });
  }

  const students = (data ?? []).filter((row) => {
    const parentPhone = digitsOnly(row.parent_phone);
    return parentPhone === inputPhone || parentPhone.endsWith(inputPhone);
  });

  if (students.length === 0) {
    return NextResponse.json({ error: "등록되지 않은 전화번호입니다." }, { status: 404 });
  }

  return NextResponse.json({ students });
}
