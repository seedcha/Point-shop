import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: string;
  department_id: string | null;
  is_active: boolean;
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
    .select("id, role, department_id, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single<AdminProfile>();

  if (profileError || !profile) {
    return { error: "활성화된 관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  if (!["master", "manager"].includes(profile.role)) {
    return { error: "상품 관리는 master 또는 manager만 사용할 수 있습니다.", status: 403 as const };
  }

  return { profile };
}

function parseProductBody(body: {
  id?: string;
  departmentId?: string;
  emoji?: string;
  imageUrl?: string | null;
  name?: string;
  priceDp?: number | string;
  stock?: number | string;
}) {
  const id = body.id?.trim();
  const departmentId = body.departmentId?.trim();
  const emoji = body.emoji?.trim() || null;
  const imageUrl = body.imageUrl?.trim() || null;
  const name = body.name?.trim();
  const priceDp = Number(body.priceDp);
  const stock = Number(body.stock);

  if (!name || name.length > 200) {
    return { error: "상품 이름은 1~200자로 입력해주세요." };
  }

  if (!Number.isInteger(priceDp) || priceDp < 0) {
    return { error: "상품 가격은 0 이상의 숫자로 입력해주세요." };
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "상품 재고는 0 이상의 숫자로 입력해주세요." };
  }

  return { id, departmentId, emoji, imageUrl, name, priceDp, stock };
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const parsed = parseProductBody(await request.json());

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const departmentId =
    admin.profile.role === "master" ? parsed.departmentId ?? admin.profile.department_id : admin.profile.department_id;

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      department_id: departmentId,
      name: parsed.name,
      price_dp: parsed.priceDp,
      emoji: parsed.emoji,
      image_url: parsed.imageUrl,
      stock: parsed.stock,
      is_active: true,
    })
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .single();

  if (error) {
    return NextResponse.json({ error: "상품을 추가하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const parsed = parseProductBody(await request.json());

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!parsed.id) {
    return NextResponse.json({ error: "수정할 상품을 선택해주세요." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("products")
    .update({
      name: parsed.name,
      price_dp: parsed.priceDp,
      stock: parsed.stock,
      emoji: parsed.emoji,
      image_url: parsed.imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id);

  if (admin.profile.role !== "master") {
    query = query.eq("department_id", admin.profile.department_id);
  }

  const { data, error } = await query
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .single();

  if (error) {
    return NextResponse.json({ error: "상품을 수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    id?: string;
    departmentId?: string;
    isActive?: boolean;
  };
  const productId = body.id?.trim();
  const departmentId =
    admin.profile.role === "master" ? body.departmentId?.trim() : admin.profile.department_id;

  if (!productId) {
    return NextResponse.json({ error: "변경할 상품을 선택해주세요." }, { status: 400 });
  }

  if (!departmentId) {
    return NextResponse.json({ error: "가맹점을 먼저 선택해주세요." }, { status: 400 });
  }

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "상품 상태를 확인해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("department_id", departmentId)
    .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "상품 상태를 변경하지 못했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "변경할 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as { id?: string; departmentId?: string };
  const productId = body.id?.trim();
  const departmentId =
    admin.profile.role === "master" ? body.departmentId?.trim() : admin.profile.department_id;

  if (!productId) {
    return NextResponse.json({ error: "삭제할 상품을 선택해주세요." }, { status: 400 });
  }

  if (!departmentId) {
    return NextResponse.json({ error: "가맹점을 먼저 선택해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("department_id", departmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "상품을 삭제하지 못했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "삭제할 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
