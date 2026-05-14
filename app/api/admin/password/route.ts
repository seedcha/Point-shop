import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminRole = "master" | "manager" | "staff";

type AdminProfile = {
  id: string;
  department_id: string;
  role: AdminRole;
  is_active: boolean;
};

type TargetAdminProfile = {
  id: string;
  login_id: string;
  email: string | null;
  auth_user_id: string;
  manager_name: string;
  department_id: string;
  role: AdminRole;
  is_active: boolean;
};

async function getActorProfile(request: NextRequest) {
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
    .select("id, department_id, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single<AdminProfile>();

  if (profileError || !profile) {
    return { error: "활성화된 관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  return { profile, authUser: userData.user };
}

function canUpdateSubordinatePassword(actor: AdminProfile, target: TargetAdminProfile) {
  if (actor.id === target.id) {
    return false;
  }

  if (actor.role === "master") {
    return target.role === "manager" || target.role === "staff";
  }

  if (actor.role === "manager") {
    return target.role === "staff" && target.department_id === actor.department_id;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const actor = await getActorProfile(request);

  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const body = (await request.json()) as {
    adminProfileId?: string;
    loginId?: string;
    email?: string;
    password?: string;
  };
  const adminProfileId = body.adminProfileId?.trim();
  const loginId = body.loginId?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!adminProfileId) {
    return NextResponse.json({ error: "변경할 관리자 계정을 선택해주세요." }, { status: 400 });
  }

  if (!password || password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "비밀번호는 6~72자로 입력해주세요." }, { status: 400 });
  }

  if (loginId && (loginId.length > 50 || !/^[a-z0-9._-]+$/.test(loginId))) {
    return NextResponse.json(
      { error: "ID는 영문 소문자, 숫자, ., _, - 조합으로 입력해주세요." },
      { status: 400 }
    );
  }

  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return NextResponse.json({ error: "이메일을 확인해주세요." }, { status: 400 });
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, login_id, email, auth_user_id, manager_name, department_id, role, is_active")
    .eq("id", adminProfileId)
    .eq("is_active", true)
    .single<TargetAdminProfile>();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: "활성화된 관리자 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!canUpdateSubordinatePassword(actor.profile, targetProfile)) {
    return NextResponse.json({ error: "하위 계정의 비밀번호만 변경할 수 있습니다." }, { status: 403 });
  }

  if (loginId && loginId !== targetProfile.login_id) {
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: "ID 중복 확인에 실패했습니다." }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json({ error: "이미 사용 중인 ID입니다." }, { status: 409 });
    }
  }

  if (email && email !== targetProfile.email) {
    const { data: existingEmail, error: emailLookupError } = await supabaseAdmin
      .from("admin_profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", targetProfile.id)
      .maybeSingle();

    if (emailLookupError) {
      return NextResponse.json({ error: "이메일 중복 확인에 실패했습니다." }, { status: 500 });
    }

    if (existingEmail) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
  }

  const updatePayload: { email?: string; password: string } = { password };

  if (email) {
    updatePayload.email = email;
  }

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

  const profileUpdate: { login_id?: string; email?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (loginId && loginId !== targetProfile.login_id) {
    profileUpdate.login_id = loginId;
  }

  if (email && email !== targetProfile.email) {
    profileUpdate.email = email;
  }

  if (profileUpdate.login_id || profileUpdate.email) {
    const { error: profileUpdateError } = await supabaseAdmin
      .from("admin_profiles")
      .update(profileUpdate)
      .eq("id", targetProfile.id);

    if (profileUpdateError) {
      return NextResponse.json({ error: "프로필 정보를 변경하지 못했습니다." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, managerName: targetProfile.manager_name });
}

export async function PATCH(request: NextRequest) {
  const actor = await getActorProfile(request);

  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  if (actor.profile.role !== "master") {
    return NextResponse.json({ error: "master만 본인 비밀번호를 직접 변경할 수 있습니다." }, { status: 403 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    password?: string;
  };
  const currentPassword = body.currentPassword?.trim();
  const password = body.password?.trim();
  const email = actor.authUser.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "master 계정의 실제 이메일이 필요합니다." }, { status: 400 });
  }

  if (!currentPassword) {
    return NextResponse.json({ error: "현재 비밀번호를 입력해주세요." }, { status: 400 });
  }

  if (!password || password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "새 비밀번호는 6~72자로 입력해주세요." }, { status: 400 });
  }

  const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    actor.authUser.id,
    { password }
  );

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "비밀번호를 변경하지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
