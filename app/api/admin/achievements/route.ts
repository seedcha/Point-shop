import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile, resolveAdminDepartment } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AchievementRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  rarity: string;
  description: string;
  image_url: string | null;
  condition_type: string;
  condition_value: number | null;
  condition_unit: string | null;
  is_automatic: boolean;
  sort_order: number;
};

function serializeAchievement(row: AchievementRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    rarity: row.rarity,
    description: row.description,
    imageUrl: row.image_url,
    conditionType: row.condition_type,
    conditionValue: row.condition_value,
    conditionUnit: row.condition_unit,
    isAutomatic: row.is_automatic,
    sortOrder: row.sort_order,
  };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const url = new URL(request.url);
  const scope = await resolveAdminDepartment(
    admin.profile,
    url.searchParams.get("departmentId")
  );

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const achievementId = url.searchParams.get("achievementId");
  const studentId = url.searchParams.get("studentId");

  if (studentId) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("department_id", scope.departmentId)
      .eq("is_active", true)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }

    const [{ data: achievements, error: achievementError }, { data: awards, error: awardError }] =
      await Promise.all([
        supabaseAdmin
          .from("achievements")
          .select(
            "id, code, name, category, rarity, description, image_url, condition_type, condition_value, condition_unit, is_automatic, sort_order"
          )
          .eq("department_id", scope.departmentId)
          .eq("is_active", true)
          .order("sort_order")
          .returns<AchievementRow[]>(),
        supabaseAdmin
          .from("student_achievements")
          .select("achievement_id")
          .eq("department_id", scope.departmentId)
          .eq("student_id", studentId),
      ]);

    if (achievementError || awardError) {
      return NextResponse.json({ error: "칭호 목록을 불러오지 못했습니다." }, { status: 500 });
    }

    const ownedAchievementIds = new Set((awards ?? []).map((award) => award.achievement_id));
    return NextResponse.json({
      achievements: (achievements ?? [])
        .filter((achievement) => !ownedAchievementIds.has(achievement.id))
        .map(serializeAchievement),
    });
  }

  if (achievementId) {
    const { data: achievement } = await supabaseAdmin
      .from("achievements")
      .select("id")
      .eq("id", achievementId)
      .eq("department_id", scope.departmentId)
      .maybeSingle();

    if (!achievement) {
      return NextResponse.json({ error: "칭호를 찾을 수 없습니다." }, { status: 404 });
    }

    const [{ data: students, error: studentError }, { data: awards, error: awardError }] =
      await Promise.all([
        supabaseAdmin
          .from("students")
          .select("id, name, grade, parent_phone")
          .eq("department_id", scope.departmentId)
          .eq("is_active", true)
          .order("name"),
        supabaseAdmin
          .from("student_achievements")
          .select("student_id")
          .eq("department_id", scope.departmentId)
          .eq("achievement_id", achievementId),
      ]);

    if (studentError || awardError) {
      return NextResponse.json({ error: "학생 목록을 불러오지 못했습니다." }, { status: 500 });
    }

    const awardedStudentIds = new Set((awards ?? []).map((award) => award.student_id));
    return NextResponse.json({
      students: (students ?? []).filter((student) => !awardedStudentIds.has(student.id)),
    });
  }

  const { data, error } = await supabaseAdmin
    .from("achievements")
    .select(
      "id, code, name, category, rarity, description, image_url, condition_type, condition_value, condition_unit, is_automatic, sort_order"
    )
    .eq("department_id", scope.departmentId)
    .eq("is_active", true)
    .order("sort_order")
    .returns<AchievementRow[]>();

  if (error) {
    return NextResponse.json({ error: "칭호 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    achievements: (data ?? []).map(serializeAchievement),
    canDelete: ["master", "manager"].includes(admin.profile.role),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json().catch(() => null)) as {
    departmentId?: string;
    achievementId?: string;
    studentId?: string;
  } | null;
  const scope = await resolveAdminDepartment(admin.profile, body?.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (!body?.achievementId || !body.studentId) {
    return NextResponse.json({ error: "칭호와 학생을 선택해주세요." }, { status: 400 });
  }

  const [{ data: achievement }, { data: student }] = await Promise.all([
    supabaseAdmin
      .from("achievements")
      .select("id")
      .eq("id", body.achievementId)
      .eq("department_id", scope.departmentId)
      .eq("is_active", true)
      .maybeSingle(),
    supabaseAdmin
      .from("students")
      .select("id")
      .eq("id", body.studentId)
      .eq("department_id", scope.departmentId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!achievement || !student) {
    return NextResponse.json({ error: "칭호 또는 학생을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("student_achievements").insert({
    department_id: scope.departmentId,
    student_id: student.id,
    achievement_id: achievement.id,
    awarded_by: admin.profile.id,
    award_source: "manual",
    award_note: "관리자 화면에서 직접 지급",
  });

  if (error?.code === "23505") {
    return NextResponse.json({ error: "이미 해당 칭호를 보유한 학생입니다." }, { status: 409 });
  }

  if (error) {
    return NextResponse.json({ error: "칭호를 지급하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  if (!["master", "manager"].includes(admin.profile.role)) {
    return NextResponse.json({ error: "관리자와 랩장만 칭호를 삭제할 수 있습니다." }, { status: 403 });
  }

  const url = new URL(request.url);
  const achievementId = url.searchParams.get("id");
  const scope = await resolveAdminDepartment(
    admin.profile,
    url.searchParams.get("departmentId")
  );

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (!achievementId) {
    return NextResponse.json({ error: "삭제할 칭호를 선택해주세요." }, { status: 400 });
  }

  await supabaseAdmin
    .from("students")
    .update({ selected_achievement_id: null })
    .eq("department_id", scope.departmentId)
    .eq("selected_achievement_id", achievementId);

  const { data, error } = await supabaseAdmin
    .from("achievements")
    .delete()
    .eq("id", achievementId)
    .eq("department_id", scope.departmentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "칭호를 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
