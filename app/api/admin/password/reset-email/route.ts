import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MasterProfile = {
  auth_user_id: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "이메일이 잘못되었습니다." }, { status: 400 });
  }

  const { data: masters, error: masterError } = await supabaseAdmin
    .from("admin_profiles")
    .select("auth_user_id")
    .eq("role", "master")
    .eq("is_active", true)
    .returns<MasterProfile[]>();

  if (masterError) {
    return NextResponse.json({ error: "master 이메일을 확인하지 못했습니다." }, { status: 500 });
  }

  let isMasterEmail = false;

  for (const master of masters ?? []) {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      master.auth_user_id
    );

    if (!authError && authUser.user?.email?.trim().toLowerCase() === email) {
      isMasterEmail = true;
      break;
    }
  }

  if (!isMasterEmail) {
    return NextResponse.json({ error: "이메일이 잘못되었습니다." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/admin/reset-password`,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "재설정 메일을 보내지 못했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
