import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminProfile = {
  id: string;
  role: "master" | "manager" | "staff";
  department_id: string | null;
};

export async function getAdminProfile(request: NextRequest) {
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

export async function resolveAdminDepartment(
  profile: AdminProfile,
  requestedDepartmentId?: string | null
) {
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
