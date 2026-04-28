import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const DEPARTMENT_PIN_PREFIX = "dept_pin:";
const PIN_PATTERN = /^[A-Z0-9]{8,12}$/;

async function getMasterProfile(request: NextRequest) {
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
    .select("id, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profile || profile.role !== "master") {
    return { error: "마스터 관리자만 사용할 수 있습니다.", status: 403 as const };
  }

  return { profile };
}

export async function GET(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("setting_key, value")
    .like("setting_key", `${DEPARTMENT_PIN_PREFIX}%`);

  if (error) {
    return NextResponse.json({ error: "PIN 설정을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ pins: data ?? [] });
}

export async function POST(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as { departmentName?: string; pin?: string };
  const departmentName = body.departmentName?.trim();
  const pin = body.pin?.trim().toUpperCase();

  if (!departmentName || !pin || !PIN_PATTERN.test(pin)) {
    return NextResponse.json(
      { error: "PIN은 영문/숫자 조합 8~12자리로 입력해주세요." },
      { status: 400 }
    );
  }

  const { data: department, error: departmentError } = await supabaseAdmin
    .from("departments")
    .select("name")
    .eq("name", departmentName)
    .eq("is_active", true)
    .single();

  if (departmentError || !department) {
    return NextResponse.json({ error: "가맹점을 찾을 수 없습니다." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("admin_settings").upsert({
    setting_key: `${DEPARTMENT_PIN_PREFIX}${department.name}`,
    value: pin,
    updated_by: master.profile.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "PIN을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
