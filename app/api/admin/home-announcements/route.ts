import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  role: string;
  department_id: string | null;
};

type NoticeType = "contest" | "vacation" | "award";

type AwardStudentInput = {
  studentName?: string;
  awardName?: string;
};

type NoticeInput = {
  id?: string;
  departmentId?: string;
  type?: NoticeType;
  title?: string;
  startDate?: string;
  endDate?: string;
  details?: string;
  awardStudents?: AwardStudentInput[];
};

type AnnouncementRow = {
  id: string;
  department_id: string;
  type: NoticeType;
  title: string;
  start_date: string;
  end_date: string;
  details: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AwardStudentRow = {
  id: string;
  announcement_id: string;
  student_name: string;
  award_name: string;
  sort_order: number;
};

const NOTICE_TYPES = new Set<NoticeType>(["contest", "vacation", "award"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ANNOUNCEMENT_COLUMNS =
  "id, department_id, type, title, start_date, end_date, details, is_active, created_by, created_at, updated_at";

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

  if (profileError || !profile || !["master", "manager"].includes(profile.role)) {
    return { error: "관리자 또는 랩장 계정만 공지를 관리할 수 있습니다.", status: 403 as const };
  }

  if (profile.role === "manager" && !profile.department_id) {
    return { error: "랩장의 가맹점 정보가 없습니다.", status: 400 as const };
  }

  return { profile };
}

async function resolveDepartmentId(profile: AdminProfile, requestedDepartmentId?: string) {
  const departmentId =
    profile.role === "master" ? requestedDepartmentId?.trim() : profile.department_id;

  if (!departmentId) {
    return { error: "관리할 가맹점을 선택해주세요.", status: 400 as const };
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

function parseNoticeInput(body: NoticeInput) {
  const id = body.id?.trim();
  const type = body.type;
  const title = body.title?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  const details = body.details?.trim() || null;

  if (!type || !NOTICE_TYPES.has(type)) {
    return { error: "공지 항목을 확인해주세요." };
  }

  if (!title || title.length > 200) {
    return { error: "공지 이름을 1~200자로 입력해주세요." };
  }

  if (!startDate || !endDate || !DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return { error: "공지 시작 날짜와 종료 날짜를 입력해주세요." };
  }

  if (endDate < startDate) {
    return { error: "종료 날짜는 시작 날짜보다 빠를 수 없습니다." };
  }

  const awardStudents =
    type === "award"
      ? (body.awardStudents ?? []).map((student, index) => ({
          student_name: student.studentName?.trim() ?? "",
          award_name: student.awardName?.trim() ?? "",
          sort_order: index,
        }))
      : [];

  if (
    type === "award" &&
    (awardStudents.length === 0 ||
      awardStudents.some((student) => !student.student_name || !student.award_name))
  ) {
    return { error: "수상 학생의 이름과 상 이름을 모두 입력해주세요." };
  }

  return { id, type, title, startDate, endDate, details, awardStudents };
}

function serializeAnnouncement(row: AnnouncementRow, students: AwardStudentRow[]) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    details: row.details ?? "",
    awardStudents: students
      .filter((student) => student.announcement_id === row.id)
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((student) => ({
        id: student.id,
        studentName: student.student_name,
        awardName: student.award_name,
      })),
  };
}

async function loadAwardStudents(announcementIds: string[]) {
  if (!announcementIds.length) {
    return { data: [] as AwardStudentRow[], error: null };
  }

  return supabaseAdmin
    .from("announcement_award_students")
    .select("id, announcement_id, student_name, award_name, sort_order")
    .in("announcement_id", announcementIds)
    .order("sort_order", { ascending: true });
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const requestedDepartmentId = new URL(request.url).searchParams.get("departmentId") ?? undefined;
  const scope = await resolveDepartmentId(admin.profile, requestedDepartmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const { data, error } = await supabaseAdmin
    .from("home_announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("department_id", scope.departmentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "공지를 불러오지 못했습니다." }, { status: 500 });
  }

  const announcements = (data ?? []) as AnnouncementRow[];
  const studentResult = await loadAwardStudents(announcements.map((announcement) => announcement.id));

  if (studentResult.error) {
    return NextResponse.json({ error: "수상 학생 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    announcements: announcements.map((announcement) =>
      serializeAnnouncement(announcement, (studentResult.data ?? []) as AwardStudentRow[])
    ),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as NoticeInput;
  const scope = await resolveDepartmentId(admin.profile, body.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const parsed = parseNoticeInput(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("home_announcements")
    .insert({
      department_id: scope.departmentId,
      type: parsed.type,
      title: parsed.title,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      details: parsed.details,
      is_active: true,
      created_by: admin.profile.id,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single<AnnouncementRow>();

  if (error || !data) {
    return NextResponse.json({ error: "공지를 저장하지 못했습니다." }, { status: 500 });
  }

  if (parsed.awardStudents.length) {
    const { error: studentError } = await supabaseAdmin
      .from("announcement_award_students")
      .insert(
        parsed.awardStudents.map((student) => ({
          announcement_id: data.id,
          ...student,
        }))
      );

    if (studentError) {
      await supabaseAdmin.from("home_announcements").delete().eq("id", data.id);
      return NextResponse.json({ error: "수상 학생 목록을 저장하지 못했습니다." }, { status: 500 });
    }
  }

  const studentResult = await loadAwardStudents([data.id]);

  return NextResponse.json({
    announcement: serializeAnnouncement(data, (studentResult.data ?? []) as AwardStudentRow[]),
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as NoticeInput;
  const scope = await resolveDepartmentId(admin.profile, body.departmentId);

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const parsed = parseNoticeInput(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!parsed.id) {
    return NextResponse.json({ error: "수정할 공지를 선택해주세요." }, { status: 400 });
  }

  const { data: previous, error: previousError } = await supabaseAdmin
    .from("home_announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", parsed.id)
    .eq("department_id", scope.departmentId)
    .maybeSingle<AnnouncementRow>();

  if (previousError || !previous) {
    return NextResponse.json({ error: "수정할 공지를 찾을 수 없습니다." }, { status: 404 });
  }

  const previousStudentsResult = await loadAwardStudents([previous.id]);
  const previousStudents = (previousStudentsResult.data ?? []) as AwardStudentRow[];

  const { data, error } = await supabaseAdmin
    .from("home_announcements")
    .update({
      type: parsed.type,
      title: parsed.title,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      details: parsed.details,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id)
    .eq("department_id", scope.departmentId)
    .select(ANNOUNCEMENT_COLUMNS)
    .single<AnnouncementRow>();

  if (error || !data) {
    return NextResponse.json({ error: "공지를 수정하지 못했습니다." }, { status: 500 });
  }

  const { error: deleteStudentsError } = await supabaseAdmin
    .from("announcement_award_students")
    .delete()
    .eq("announcement_id", parsed.id);

  let studentError = deleteStudentsError;

  if (!studentError && parsed.awardStudents.length) {
    const result = await supabaseAdmin
      .from("announcement_award_students")
      .insert(
        parsed.awardStudents.map((student) => ({
          announcement_id: parsed.id,
          ...student,
        }))
      );
    studentError = result.error;
  }

  if (studentError) {
    await supabaseAdmin
      .from("home_announcements")
      .update({
        type: previous.type,
        title: previous.title,
        start_date: previous.start_date,
        end_date: previous.end_date,
        details: previous.details,
        updated_at: previous.updated_at,
      })
      .eq("id", previous.id);
    await supabaseAdmin.from("announcement_award_students").delete().eq("announcement_id", previous.id);

    if (previousStudents.length) {
      await supabaseAdmin.from("announcement_award_students").insert(
        previousStudents.map((student) => ({
          announcement_id: previous.id,
          student_name: student.student_name,
          award_name: student.award_name,
          sort_order: student.sort_order,
        }))
      );
    }

    return NextResponse.json({ error: "수상 학생 목록을 수정하지 못했습니다." }, { status: 500 });
  }

  const studentResult = await loadAwardStudents([data.id]);

  return NextResponse.json({
    announcement: serializeAnnouncement(data, (studentResult.data ?? []) as AwardStudentRow[]),
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const scope = await resolveDepartmentId(
    admin.profile,
    url.searchParams.get("departmentId") ?? undefined
  );

  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  if (!id) {
    return NextResponse.json({ error: "삭제할 공지를 선택해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("home_announcements")
    .delete()
    .eq("id", id)
    .eq("department_id", scope.departmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "공지를 삭제하지 못했습니다." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "삭제할 공지를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
