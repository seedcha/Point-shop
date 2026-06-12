import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: string;
  department_id: string | null;
};

type PurchaseRequestRow = {
  id: string;
  department_id: string;
  student_id: string;
  product_id: string;
  quantity: number;
  status: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  name: string;
  points: number;
  department_id: string;
};

type ProductRow = {
  id: string;
  department_id: string;
  name: string;
  category: string | null;
  price_dp: number;
  stock: number;
  is_active: boolean;
  emoji: string | null;
  image_url: string | null;
};

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
    .single<AdminProfile>();

  if (profileError || !profile || !["master", "manager", "staff"].includes(profile.role)) {
    return { error: "구매 신청 관리 권한이 없습니다.", status: 403 as const };
  }

  if (profile.role !== "master" && !profile.department_id) {
    return { error: "소속 가맹점 정보가 없습니다.", status: 400 as const };
  }

  return { profile };
}

function resolveDepartmentId(
  profile: AdminProfile,
  requestedDepartmentId?: string | null
) {
  const departmentId =
    profile.role === "master" ? requestedDepartmentId?.trim() : profile.department_id;

  if (!departmentId) {
    return { error: "가맹점을 먼저 선택해주세요." };
  }

  return { departmentId };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const scope = resolveDepartmentId(
    admin.profile,
    new URL(request.url).searchParams.get("departmentId")
  );

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: 400 });
  }

  const departmentId = scope.departmentId;

  const { data: requests, error: requestError } = await supabaseAdmin
    .from("purchase_requests")
    .select("id, department_id, student_id, product_id, quantity, status, created_at")
    .eq("department_id", departmentId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<PurchaseRequestRow[]>();

  if (requestError) {
    return NextResponse.json({ error: "구매 신청 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const requestRows = requests ?? [];

  if (!requestRows.length) {
    return NextResponse.json({ purchaseRequests: [] });
  }

  const studentIds = Array.from(new Set(requestRows.map((row) => row.student_id)));
  const productIds = Array.from(new Set(requestRows.map((row) => row.product_id)));

  const { data: students, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, name, points, department_id")
    .eq("department_id", departmentId)
    .in("id", studentIds)
    .returns<StudentRow[]>();

  if (studentError) {
    return NextResponse.json({ error: "학생 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: products, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .eq("department_id", departmentId)
    .in("id", productIds)
    .returns<ProductRow[]>();

  if (productError) {
    return NextResponse.json({ error: "상품 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const studentMap = new Map((students ?? []).map((student) => [student.id, student]));
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const purchaseRequests = requestRows
    .map((request) => {
      const student = studentMap.get(request.student_id);
      const product = productMap.get(request.product_id);

      if (!student || !product) {
        return null;
      }

      return {
        id: request.id,
        productId: product.id,
        productName: product.name,
        productEmoji: product.emoji,
        productImageUrl: product.image_url,
        productPrice: product.price_dp * request.quantity,
        productStock: product.stock,
        studentId: student.id,
        studentName: student.name,
        studentPoints: student.points,
        createdAt: request.created_at,
      };
    })
    .filter((request): request is NonNullable<typeof request> => Boolean(request));

  return NextResponse.json({ purchaseRequests });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    purchaseId?: string;
    departmentId?: string;
    action?: "approve" | "reject";
  };
  const requestId = body.purchaseId?.trim();
  const scope = resolveDepartmentId(admin.profile, body.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: 400 });
  }

  const departmentId = scope.departmentId;

  if (!requestId || !body.action) {
    return NextResponse.json({ error: "구매 신청 정보를 확인해주세요." }, { status: 400 });
  }

  const { data: purchaseRequest, error: requestError } = await supabaseAdmin
    .from("purchase_requests")
    .select("id, department_id, student_id, product_id, quantity, status")
    .eq("id", requestId)
    .eq("department_id", departmentId)
    .eq("status", "pending")
    .single<PurchaseRequestRow>();

  if (requestError || !purchaseRequest) {
    return NextResponse.json({ error: "대기 중인 구매 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.action === "reject") {
    const { error } = await supabaseAdmin
      .from("purchase_requests")
      .update({
        status: "rejected",
        handled_by: admin.profile.id,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseRequest.id);

    if (error) {
      return NextResponse.json({ error: "구매 신청을 거절하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, department_id, points")
    .eq("id", purchaseRequest.student_id)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .single<Pick<StudentRow, "id" | "department_id" | "points">>();

  if (studentError || !student) {
    return NextResponse.json({ error: "신청 학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .eq("id", purchaseRequest.product_id)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .single<ProductRow>();

  if (productError || !product) {
    return NextResponse.json({ error: "상품 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (product.stock < purchaseRequest.quantity) {
    return NextResponse.json({ error: "상품 재고가 부족합니다." }, { status: 400 });
  }

  const dpSpent = product.price_dp * purchaseRequest.quantity;

  if (student.points < dpSpent) {
    return NextResponse.json({ error: "학생 보유 포인트가 부족합니다." }, { status: 400 });
  }

  const balanceAfter = student.points - dpSpent;

  const { data: updatedProduct, error: productUpdateError } = await supabaseAdmin
    .from("products")
    .update({ stock: product.stock - purchaseRequest.quantity, updated_at: new Date().toISOString() })
    .eq("id", product.id)
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .single<ProductRow>();

  if (productUpdateError || !updatedProduct) {
    return NextResponse.json({ error: "상품 재고를 변경하지 못했습니다." }, { status: 500 });
  }

  const { error: studentUpdateError } = await supabaseAdmin
    .from("students")
    .update({ points: balanceAfter, updated_at: new Date().toISOString() })
    .eq("id", student.id);

  if (studentUpdateError) {
    return NextResponse.json({ error: "학생 포인트를 차감하지 못했습니다." }, { status: 500 });
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert({
      student_id: student.id,
      product_id: product.id,
      product_name: product.name,
      quantity: purchaseRequest.quantity,
      dp_spent: dpSpent,
      status: "completed",
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "구매 내역을 저장하지 못했습니다." }, { status: 500 });
  }

  const { error: requestUpdateError } = await supabaseAdmin
    .from("purchase_requests")
    .update({
      status: "approved",
      handled_by: admin.profile.id,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchaseRequest.id);

  if (requestUpdateError) {
    return NextResponse.json({ error: "구매 신청 상태를 변경하지 못했습니다." }, { status: 500 });
  }

  const { error: transactionError } = await supabaseAdmin.from("point_transactions").insert({
    department_id: departmentId,
    student_id: student.id,
    purchase_id: purchase.id,
    amount: -dpSpent,
    balance_after: balanceAfter,
    transaction_type: "purchase",
    reason: `${product.name} 구매`,
    adjusted_by: admin.profile.id,
  });

  if (transactionError) {
    return NextResponse.json({ error: "포인트 내역을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    product: updatedProduct,
    student: { id: student.id, points: balanceAfter },
  });
}
