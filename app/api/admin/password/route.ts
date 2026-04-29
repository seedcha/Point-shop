import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: string;
  is_active: boolean;
};

type TargetAdminProfile = {
  id: string;
  login_id: string;
  auth_user_id: string;
  manager_name: string;
  role: string;
  is_active: boolean;
};

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
    .single<AdminProfile>();

  if (profileError || !profile || profile.role !== "master") {
    return { error: "마스터 관리자만 사용할 수 있습니다.", status: 403 as const };
  }

  return { profile };
}

export async function POST(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as {
    adminProfileId?: string;
    loginId?: string;
    password?: string;
  };
  const adminProfileId = body.adminProfileId?.trim();
  const loginId = body.loginId?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!adminProfileId) {
    return NextResponse.json({ error: "변경할 관리자 계정을 선택해주세요." }, { status: 400 });
  }

  if (!password || password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "비밀번호는 6~72자로 입력해주세요." }, { status: 400 });
  }

  if (loginId && (loginId.length > 50 || !/^[a-z0-9._-]+$/.test(loginId))) {
    return NextResponse.json(
      { error: "manager ID는 영문 소문자, 숫자, ., _, - 조합으로 입력해주세요." },
      { status: 400 }
    );
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, login_id, auth_user_id, manager_name, role, is_active")
    .eq("id", adminProfileId)
    .eq("is_active", true)
    .single<TargetAdminProfile>();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: "활성화된 관리자 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!["master", "manager", "staff"].includes(targetProfile.role)) {
    return NextResponse.json({ error: "관리자 계정만 변경할 수 있습니다." }, { status: 400 });
  }

  if (loginId && loginId !== targetProfile.login_id) {
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: "manager ID 중복 확인에 실패했습니다." }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json({ error: "이미 사용 중인 manager ID입니다." }, { status: 409 });
    }
  }

  const updatePayload = loginId
    ? { email: `${loginId}@daddyslab.com`, password }
    : { password };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    targetProfile.auth_user_id,
    updatePayload
  );

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "계정 정보를 변경하지 못했습니다." },
      { status: 500 }
    );
  }

  if (loginId && loginId !== targetProfile.login_id) {
    const { error: profileUpdateError } = await supabaseAdmin
      .from("admin_profiles")
      .update({ login_id: loginId, updated_at: new Date().toISOString() })
      .eq("id", targetProfile.id);

    if (profileUpdateError) {
      return NextResponse.json({ error: "manager ID를 변경하지 못했습니다." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, managerName: targetProfile.manager_name });
}
