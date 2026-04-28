import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const studentId = new URL(request.url).searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "학생 정보가 없습니다." }, { status: 400 });
  }

  const { data: pointTransactions, error: pointError } = await supabaseAdmin
    .from("point_transactions")
    .select("id, created_at, reason, amount, transaction_type")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (pointError) {
    return NextResponse.json({ error: "포인트 내역을 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: purchases, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .select("id, created_at, product_name, quantity, dp_spent, status")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (purchaseError) {
    return NextResponse.json({ error: "구매 내역을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    pointTransactions: pointTransactions ?? [],
    purchases: purchases ?? [],
  });
}
