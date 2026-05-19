import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: string;
  department_id: string | null;
};

type PurchaseRequestRow = {
  id: string;
  product_id: string;
  product_name: string;
  dp_spent: number;
  created_at: string;
  products:
    | {
        id: string;
        emoji: string | null;
        image_url: string | null;
        price_dp: number;
        stock: number;
        department_id: string;
      }
    | Array<{
        id: string;
        emoji: string | null;
        image_url: string | null;
        price_dp: number;
        stock: number;
        department_id: string;
      }>
    | null;
  students:
    | {
        id: string;
        name: string;
        points: number;
        department_id: string;
      }
    | Array<{
        id: string;
        name: string;
        points: number;
        department_id: string;
      }>
    | null;
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

  if (profileError || !profile || !["master", "manager"].includes(profile.role)) {
    return { error: "구매 신청 관리 권한이 없습니다.", status: 403 as const };
  }

  return { profile };
}

function pickOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveDepartmentId(profile: AdminProfile, requestedDepartmentId?: string | null) {
  return profile.role === "master" ? requestedDepartmentId?.trim() : profile.department_id;
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const requestedDepartmentId = new URL(request.url).searchParams.get("departmentId");
  const departmentId = resolveDepartmentId(admin.profile, requestedDepartmentId);

  if (!departmentId) {
    return NextResponse.json({ error: "가맹점을 먼저 선택해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select(
      "id, product_id, product_name, dp_spent, created_at, products!inner(id, emoji, image_url, price_dp, stock, department_id), students!inner(id, name, points, department_id)"
    )
    .eq("status", "pending")
    .eq("students.department_id", departmentId)
    .order("created_at", { ascending: true })
    .returns<PurchaseRequestRow[]>();

  if (error) {
    return NextResponse.json({ error: "구매 신청 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  const purchaseRequests = (data ?? [])
    .map((request) => {
      const product = pickOne(request.products);
      const student = pickOne(request.students);

      if (!product || !student || student.department_id !== departmentId) {
        return null;
      }

      return {
        id: request.id,
        productId: product.id,
        productName: request.product_name,
        productEmoji: product.emoji,
        productImageUrl: product.image_url,
        productPrice: request.dp_spent || product.price_dp,
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
  const purchaseId = body.purchaseId?.trim();
  const departmentId = resolveDepartmentId(admin.profile, body.departmentId);

  if (!purchaseId || !departmentId || !body.action) {
    return NextResponse.json({ error: "구매 신청 정보를 확인해주세요." }, { status: 400 });
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .select("id, product_id, product_name, student_id, dp_spent, status")
    .eq("id", purchaseId)
    .eq("status", "pending")
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "대기 중인 구매 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, department_id, points")
    .eq("id", purchase.student_id)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "신청 학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.action === "reject") {
    const { error } = await supabaseAdmin
      .from("purchases")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", purchase.id);

    if (error) {
      return NextResponse.json({ error: "구매 신청을 거절하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .eq("id", purchase.product_id)
    .eq("department_id", departmentId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "상품 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (product.stock <= 0) {
    return NextResponse.json({ error: "상품 재고가 없습니다." }, { status: 400 });
  }

  if (student.points < purchase.dp_spent) {
    return NextResponse.json({ error: "학생 보유 포인트가 부족합니다." }, { status: 400 });
  }

  const balanceAfter = student.points - purchase.dp_spent;

  const { data: updatedProduct, error: productUpdateError } = await supabaseAdmin
    .from("products")
    .update({ stock: product.stock - 1, updated_at: new Date().toISOString() })
    .eq("id", product.id)
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .single();

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

  const { error: purchaseUpdateError } = await supabaseAdmin
    .from("purchases")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", purchase.id);

  if (purchaseUpdateError) {
    return NextResponse.json({ error: "구매 신청 상태를 변경하지 못했습니다." }, { status: 500 });
  }

  const { error: transactionError } = await supabaseAdmin.from("point_transactions").insert({
    department_id: departmentId,
    student_id: student.id,
    purchase_id: purchase.id,
    amount: -purchase.dp_spent,
    balance_after: balanceAfter,
    transaction_type: "purchase",
    reason: `${purchase.product_name} 구매`,
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
