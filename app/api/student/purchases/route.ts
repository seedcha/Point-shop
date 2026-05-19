import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { studentId?: string; productId?: string };

  if (!body.studentId || !body.productId) {
    return NextResponse.json({ error: "구매 정보를 확인해주세요." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, department_id, points, is_active")
    .eq("id", body.studentId)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "학생 정보를 불러오지 못했습니다." }, { status: 404 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, department_id, name, price_dp, stock, is_active")
    .eq("id", body.productId)
    .eq("is_active", true)
    .single();

  if (productError || !product || product.department_id !== student.department_id) {
    return NextResponse.json({ error: "구매할 수 없는 상품입니다." }, { status: 404 });
  }

  if (product.stock <= 0) {
    return NextResponse.json({ error: "상품 재고가 없습니다." }, { status: 400 });
  }

  if (student.points < product.price_dp) {
    return NextResponse.json({ error: "포인트가 부족합니다." }, { status: 400 });
  }

  const { data: requestRow, error: requestError } = await supabaseAdmin
    .from("purchase_requests")
    .insert({
      department_id: student.department_id,
      student_id: student.id,
      product_id: product.id,
      quantity: 1,
      status: "pending",
    })
    .select("id")
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "구매 신청을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ requestId: requestRow.id, points: student.points });
}
