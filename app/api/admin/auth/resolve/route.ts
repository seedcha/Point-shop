import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const AUTH_EMAIL_DOMAIN = "@daddyslab.com";

type AdminLookupRow = {
  login_id: string;
  auth_user_id: string;
  role: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { identifier?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();

  if (!identifier) {
    return NextResponse.json({ error: "아이디 또는 이메일을 입력해주세요." }, { status: 400 });
  }

  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier });
  }

  const { data: profile, error } = await supabaseAdmin
    .from("admin_profiles")
    .select("login_id, auth_user_id, role")
    .eq("login_id", identifier)
    .eq("is_active", true)
    .maybeSingle<AdminLookupRow>();

  if (error || !profile) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  if (profile.role === "master") {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      profile.auth_user_id
    );

    if (authError || !authUser.user?.email) {
      return NextResponse.json({ error: "master 계정 이메일을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ email: authUser.user.email.trim().toLowerCase() });
  }

  return NextResponse.json({ email: `${profile.login_id}${AUTH_EMAIL_DOMAIN}` });
}
