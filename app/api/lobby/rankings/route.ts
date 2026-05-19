import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type StudentRow = {
  id: string;
  name: string;
  grade: string;
  points: number;
};

type PointTransactionRow = {
  student_id: string;
  amount: number;
};

function toRankRows(students: StudentRow[], cumulativeByStudent: Map<string, number>, mode: "honor" | "assets") {
  return students
    .map((student) => {
      const cumulativePoints = Math.max(cumulativeByStudent.get(student.id) ?? 0, student.points);

      return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        points: mode === "honor" ? cumulativePoints : student.points,
      };
    })
    .sort((first, second) => second.points - first.points || first.name.localeCompare(second.name))
    .slice(0, 5);
}

export async function GET(request: Request) {
  const requestedDepartmentId = new URL(request.url).searchParams.get("departmentId")?.trim();

  const { data: departments, error: departmentsError } = await supabaseAdmin
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (departmentsError) {
    return NextResponse.json({ error: "가맹점 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const departmentRows = departments ?? [];
  const selectedDepartment =
    departmentRows.find((department) => department.id === requestedDepartmentId) ?? departmentRows[0] ?? null;

  if (!selectedDepartment) {
    return NextResponse.json({
      departments: [],
      selectedDepartmentId: null,
      rankings: {
        honor: [],
        assets: [],
      },
    });
  }

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, name, grade, points")
    .eq("department_id", selectedDepartment.id)
    .eq("is_active", true);

  if (studentsError) {
    return NextResponse.json({ error: "학생 랭킹을 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: transactions, error: transactionsError } = await supabaseAdmin
    .from("point_transactions")
    .select("student_id, amount")
    .eq("department_id", selectedDepartment.id)
    .gt("amount", 0);

  if (transactionsError) {
    return NextResponse.json({ error: "누적 포인트를 불러오지 못했습니다." }, { status: 500 });
  }

  const cumulativeByStudent = new Map<string, number>();

  ((transactions ?? []) as PointTransactionRow[]).forEach((transaction) => {
    cumulativeByStudent.set(
      transaction.student_id,
      (cumulativeByStudent.get(transaction.student_id) ?? 0) + transaction.amount
    );
  });

  const studentRows = (students ?? []) as StudentRow[];

  return NextResponse.json({
    departments: departmentRows,
    selectedDepartmentId: selectedDepartment.id,
    rankings: {
      honor: toRankRows(studentRows, cumulativeByStudent, "honor"),
      assets: toRankRows(studentRows, cumulativeByStudent, "assets"),
    },
  });
}
