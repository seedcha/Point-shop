import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const AUTH_EMAIL_DOMAIN = "@daddyslab.com";

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

export async function POST(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as {
    name?: string;
    managerName?: string;
    managerLoginId?: string;
    managerPassword?: string;
  };
  const name = body.name?.trim();
  const managerName = body.managerName?.trim();
  const managerLoginId = body.managerLoginId?.trim().toLowerCase();
  const managerPassword = body.managerPassword ?? "";

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "가맹점명은 1~50자로 입력해주세요." }, { status: 400 });
  }

  if (!managerName || managerName.length > 50) {
    return NextResponse.json({ error: "가맹점 주인 이름은 1~50자로 입력해주세요." }, { status: 400 });
  }

  if (!managerLoginId || managerLoginId.length > 50 || !/^[a-z0-9._-]+$/.test(managerLoginId)) {
    return NextResponse.json(
      { error: "manager ID는 영문 소문자, 숫자, ., _, - 조합으로 입력해주세요." },
      { status: 400 }
    );
  }

  if (managerPassword.length < 6 || managerPassword.length > 72) {
    return NextResponse.json({ error: "manager PW는 6~72자로 입력해주세요." }, { status: 400 });
  }

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id")
    .eq("login_id", managerLoginId)
    .maybeSingle();

  if (profileLookupError) {
    return NextResponse.json({ error: "manager ID 중복 확인에 실패했습니다." }, { status: 500 });
  }

  if (existingProfile) {
    return NextResponse.json({ error: "이미 사용 중인 manager ID입니다." }, { status: 409 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "가맹점 정보를 확인하지 못했습니다." }, { status: 500 });
  }

  let department: { id: string; name: string };
  let createdDepartment = false;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: "가맹점을 활성화하지 못했습니다." }, { status: 500 });
    }

    department = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({ name })
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: "가맹점을 추가하지 못했습니다." }, { status: 500 });
    }

    department = data;
    createdDepartment = true;
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `${managerLoginId}${AUTH_EMAIL_DOMAIN}`,
    password: managerPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    if (createdDepartment) {
      await supabaseAdmin.from("departments").delete().eq("id", department.id);
    }

    return NextResponse.json(
      { error: authError?.message ?? "manager Auth 계정을 생성하지 못했습니다." },
      { status: 500 }
    );
  }

  const { data: manager, error: managerError } = await supabaseAdmin
    .from("admin_profiles")
    .insert({
      login_id: managerLoginId,
      manager_name: managerName,
      auth_user_id: authData.user.id,
      role: "manager",
      department_id: department.id,
    })
    .select("id, login_id, manager_name, role")
    .single();

  if (managerError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (createdDepartment) {
      await supabaseAdmin.from("departments").delete().eq("id", department.id);
    }

    return NextResponse.json({ error: "manager 프로필을 생성하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ department, manager });
}

export async function DELETE(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const departmentId = new URL(request.url).searchParams.get("departmentId");

  if (!departmentId) {
    return NextResponse.json({ error: "삭제할 가맹점을 선택해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("departments")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", departmentId);

  if (error) {
    return NextResponse.json({ error: "가맹점을 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
