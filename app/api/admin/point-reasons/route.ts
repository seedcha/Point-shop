import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: "master" | "manager" | "staff";
  department_id: string | null;
};

type ReasonRow = {
  id: string;
  department_id: string;
  label: string;
  default_points: number | null;
  sort_order: number;
};

const REQUIRED_REASON_LABELS = new Set(["등원", "수업 참여도 우수", "포인트 조정", "기타"]);

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

  if (profileError || !profile) {
    return { error: "활성화된 관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  return { profile };
}

async function resolveDepartmentId(profile: AdminProfile, requestedDepartmentId?: string) {
  const departmentId =
    profile.role === "master" ? requestedDepartmentId?.trim() : profile.department_id;

  if (!departmentId) {
    return { error: "가맹점을 선택해주세요.", status: 400 as const };
  }

  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return { error: "선택한 가맹점을 찾을 수 없습니다.", status: 404 as const };
  }

  return { departmentId };
}

function serializeReason(reason: ReasonRow) {
  return {
    id: reason.id,
    label: reason.label,
    defaultPoints: reason.default_points,
    sortOrder: reason.sort_order,
  };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const departmentId = new URL(request.url).searchParams.get("departmentId") ?? undefined;
  const scope = await resolveDepartmentId(admin.profile, departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const { data, error } = await supabaseAdmin
    .from("point_reason_presets")
    .select("id, department_id, label, default_points, sort_order")
    .eq("department_id", scope.departmentId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "포인트 사유를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    reasons: ((data ?? []) as ReasonRow[]).map(serializeReason),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (!["master", "manager"].includes(admin.profile.role)) {
    return NextResponse.json({ error: "관리자와 랩장만 사유를 추가할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json()) as {
    departmentId?: string;
    label?: string;
    defaultPoints?: number | string | null;
  };
  const scope = await resolveDepartmentId(admin.profile, body.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const label = body.label?.trim();

  if (!label || label.length > 100) {
    return NextResponse.json({ error: "사유 이름을 1~100자로 입력해주세요." }, { status: 400 });
  }

  if (["사유 추가", "사유 삭제"].includes(label)) {
    return NextResponse.json({ error: "사용할 수 없는 사유 이름입니다." }, { status: 400 });
  }

  const defaultPoints =
    body.defaultPoints === null || body.defaultPoints === "" ? null : Number(body.defaultPoints);

  if (defaultPoints !== null && (!Number.isInteger(defaultPoints) || defaultPoints < 0)) {
    return NextResponse.json({ error: "포인트 값은 0 이상의 정수로 입력해주세요." }, { status: 400 });
  }

  const { data: lastReason, error: lastReasonError } = await supabaseAdmin
    .from("point_reason_presets")
    .select("sort_order")
    .eq("department_id", scope.departmentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  if (lastReasonError) {
    return NextResponse.json({ error: "포인트 사유 순서를 확인하지 못했습니다." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("point_reason_presets")
    .insert({
      department_id: scope.departmentId,
      label,
      default_points: defaultPoints,
      sort_order: (lastReason?.sort_order ?? -1) + 1,
      created_by: admin.profile.id,
    })
    .select("id, department_id, label, default_points, sort_order")
    .single<ReasonRow>();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "이미 등록된 사유입니다." }, { status: 409 });
  }

  if (error || !data) {
    return NextResponse.json({ error: "사유를 추가하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ reason: serializeReason(data) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (!["master", "manager"].includes(admin.profile.role)) {
    return NextResponse.json({ error: "관리자와 랩장만 포인트 값을 수정할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    departmentId?: string;
    defaultPoints?: number | string | null;
    orderedIds?: string[];
  };
  const scope = await resolveDepartmentId(admin.profile, body.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (body.orderedIds) {
    const orderedIds = body.orderedIds.filter(
      (id, index, ids) => typeof id === "string" && id && ids.indexOf(id) === index
    );
    const { data: currentReasons, error: currentReasonsError } = await supabaseAdmin
      .from("point_reason_presets")
      .select("id")
      .eq("department_id", scope.departmentId)
      .eq("is_active", true);

    if (currentReasonsError) {
      return NextResponse.json({ error: "포인트 사유 순서를 확인하지 못했습니다." }, { status: 500 });
    }

    const currentIds = (currentReasons ?? []).map((reason) => reason.id);
    const hasSameReasons =
      orderedIds.length === currentIds.length &&
      currentIds.every((id) => orderedIds.includes(id));

    if (!hasSameReasons) {
      return NextResponse.json(
        { error: "포인트 사유 목록이 변경되었습니다. 새로고침 후 다시 시도해주세요." },
        { status: 409 }
      );
    }

    for (const [sortOrder, id] of orderedIds.entries()) {
      const { error } = await supabaseAdmin
        .from("point_reason_presets")
        .update({
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("department_id", scope.departmentId);

      if (error) {
        return NextResponse.json({ error: "포인트 사유 순서를 변경하지 못했습니다." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  const reasonId = body.id?.trim();

  if (!reasonId) {
    return NextResponse.json({ error: "수정할 사유를 선택해주세요." }, { status: 400 });
  }

  const defaultPoints =
    body.defaultPoints === null || body.defaultPoints === "" ? null : Number(body.defaultPoints);

  if (defaultPoints !== null && (!Number.isInteger(defaultPoints) || defaultPoints < 0)) {
    return NextResponse.json({ error: "포인트 값은 0 이상의 정수로 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("point_reason_presets")
    .update({
      default_points: defaultPoints,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reasonId)
    .eq("department_id", scope.departmentId)
    .select("id, department_id, label, default_points, sort_order")
    .maybeSingle<ReasonRow>();

  if (error) {
    return NextResponse.json({ error: "포인트 값을 수정하지 못했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "수정할 사유를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ reason: serializeReason(data) });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (!["master", "manager"].includes(admin.profile.role)) {
    return NextResponse.json({ error: "관리자와 랩장만 사유를 삭제할 수 있습니다." }, { status: 403 });
  }

  const url = new URL(request.url);
  const reasonId = url.searchParams.get("id")?.trim();
  const scope = await resolveDepartmentId(
    admin.profile,
    url.searchParams.get("departmentId") ?? undefined
  );

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (!reasonId) {
    return NextResponse.json({ error: "삭제할 사유를 선택해주세요." }, { status: 400 });
  }

  const { data: reason, error: reasonError } = await supabaseAdmin
    .from("point_reason_presets")
    .select("id, label")
    .eq("id", reasonId)
    .eq("department_id", scope.departmentId)
    .maybeSingle();

  if (reasonError || !reason) {
    return NextResponse.json({ error: "삭제할 사유를 찾을 수 없습니다." }, { status: 404 });
  }

  if (REQUIRED_REASON_LABELS.has(reason.label)) {
    return NextResponse.json({ error: "기본 사유는 삭제할 수 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("point_reason_presets")
    .delete()
    .eq("id", reasonId)
    .eq("department_id", scope.departmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "사유를 삭제하지 못했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "삭제할 사유를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
