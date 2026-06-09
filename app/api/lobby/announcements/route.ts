import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type NoticeType = "contest" | "vacation" | "award";

type AnnouncementRow = {
  id: string;
  type: NoticeType;
  title: string;
  start_date: string;
  end_date: string;
  details: string | null;
};

type AwardStudentRow = {
  id: string;
  announcement_id: string;
  student_name: string;
  award_name: string;
  sort_order: number;
};

function getKoreaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const departmentId = new URL(request.url).searchParams.get("departmentId")?.trim();

  if (!departmentId) {
    return NextResponse.json({ error: "가맹점을 선택해주세요." }, { status: 400 });
  }

  const { data: department, error: departmentError } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (departmentError || !department) {
    return NextResponse.json({ error: "선택한 가맹점을 찾을 수 없습니다." }, { status: 404 });
  }

  const today = getKoreaDate();
  const { data, error } = await supabaseAdmin
    .from("home_announcements")
    .select("id, type, title, start_date, end_date, details")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "공지를 불러오지 못했습니다." }, { status: 500 });
  }

  const announcements = (data ?? []) as AnnouncementRow[];
  const awardAnnouncementIds = announcements
    .filter((announcement) => announcement.type === "award")
    .map((announcement) => announcement.id);
  let awardStudents: AwardStudentRow[] = [];

  if (awardAnnouncementIds.length) {
    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from("announcement_award_students")
      .select("id, announcement_id, student_name, award_name, sort_order")
      .in("announcement_id", awardAnnouncementIds)
      .order("sort_order", { ascending: true });

    if (studentError) {
      return NextResponse.json({ error: "수상 학생 목록을 불러오지 못했습니다." }, { status: 500 });
    }

    awardStudents = (studentRows ?? []) as AwardStudentRow[];
  }

  return NextResponse.json({
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      type: announcement.type,
      title: announcement.title,
      startDate: announcement.start_date,
      endDate: announcement.end_date,
      details: announcement.details ?? "",
      awardStudents: awardStudents
        .filter((student) => student.announcement_id === announcement.id)
        .map((student) => ({
          id: student.id,
          studentName: student.student_name,
          awardName: student.award_name,
        })),
    })),
  });
}
