import { NextRequest, NextResponse } from "next/server";

import { getStudentSession } from "@/lib/student-session";
import { supabaseAdmin } from "@/lib/supabase/admin";

function serializeAchievement(row: {
  id: string;
  awarded_at: string;
  achievements: unknown;
}) {
  const achievement = (Array.isArray(row.achievements)
    ? row.achievements[0]
    : row.achievements) as {
    id: string;
    name: string;
    rarity: string;
    description: string;
    image_url: string | null;
  } | null;

  return achievement
    ? {
        id: achievement.id,
        name: achievement.name,
        rarity: achievement.rarity,
        description: achievement.description,
        imageUrl: achievement.image_url,
        awardedAt: row.awarded_at,
      }
    : null;
}

export async function GET(request: NextRequest) {
  const session = getStudentSession(request);

  if (!session) {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, selected_achievement_id")
    .eq("id", session.studentId)
    .eq("department_id", session.departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("student_achievements")
    .select("id, awarded_at, achievements(id, name, rarity, description, image_url)")
    .eq("student_id", student.id)
    .eq("department_id", session.departmentId)
    .order("awarded_at");

  if (error) {
    return NextResponse.json({ error: "보유 칭호를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    selectedAchievementId: student.selected_achievement_id,
    achievements: (data ?? []).map(serializeAchievement).filter(Boolean),
  });
}

export async function PATCH(request: NextRequest) {
  const session = getStudentSession(request);

  if (!session) {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    achievementId?: string | null;
  } | null;
  const achievementId = body?.achievementId ?? null;

  if (achievementId) {
    const { data: owned } = await supabaseAdmin
      .from("student_achievements")
      .select("id")
      .eq("student_id", session.studentId)
      .eq("department_id", session.departmentId)
      .eq("achievement_id", achievementId)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json({ error: "보유한 칭호만 선택할 수 있습니다." }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin
    .from("students")
    .update({ selected_achievement_id: achievementId, updated_at: new Date().toISOString() })
    .eq("id", session.studentId)
    .eq("department_id", session.departmentId);

  if (error) {
    return NextResponse.json({ error: "대표 칭호를 변경하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
