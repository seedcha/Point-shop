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
    return NextResponse.json({ error: "보유 DP가 부족합니다." }, { status: 400 });
  }

  const balanceAfter = student.points - product.price_dp;

  const { error: studentUpdateError } = await supabaseAdmin
    .from("students")
    .update({ points: balanceAfter, updated_at: new Date().toISOString() })
    .eq("id", student.id);

  if (studentUpdateError) {
    return NextResponse.json({ error: "포인트를 차감하지 못했습니다." }, { status: 500 });
  }

  const { error: productUpdateError } = await supabaseAdmin
    .from("products")
    .update({ stock: product.stock - 1, updated_at: new Date().toISOString() })
    .eq("id", product.id);

  if (productUpdateError) {
    return NextResponse.json({ error: "상품 재고를 변경하지 못했습니다." }, { status: 500 });
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert({
      student_id: student.id,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      dp_spent: product.price_dp,
      status: "completed",
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "구매 내역을 저장하지 못했습니다." }, { status: 500 });
  }

  const { error: transactionError } = await supabaseAdmin.from("point_transactions").insert({
    department_id: student.department_id,
    student_id: student.id,
    purchase_id: purchase.id,
    amount: -product.price_dp,
    balance_after: balanceAfter,
    transaction_type: "purchase",
    reason: `${product.name} 구매`,
  });

  if (transactionError) {
    return NextResponse.json({ error: "포인트 내역을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ points: balanceAfter });
}
