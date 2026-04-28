import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const studentId = new URL(request.url).searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "학생 정보가 없습니다." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("department_id")
    .eq("id", studentId)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "학생 정보를 불러오지 못했습니다." }, { status: 404 });
  }

  const { data: products, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, name, category, price_dp, stock, emoji, image_url")
    .eq("department_id", student.department_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (productError) {
    return NextResponse.json({ error: "상품을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ products: products ?? [] });
}
