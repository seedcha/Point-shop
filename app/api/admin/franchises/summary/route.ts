import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminProfile = {
  id: string;
  manager_name: string;
  role: string;
  department_id: string;
  is_active: boolean;
};

type StudentRow = {
  id: string;
  department_id: string;
  teacher_id: string | null;
  parent_phone: string;
  name: string;
  grade: string;
  points: number;
  is_active: boolean;
  created_at: string;
};

type TransactionRow = {
  id: string;
  student_id: string;
  amount: number;
  reason: string;
  adjusted_by: string | null;
  created_at: string;
  students: { name: string }[] | { name: string } | null;
};

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
    .select("id, manager_name, role, department_id, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single<AdminProfile>();

  if (profileError || !profile) {
    return { error: "활성화된 관리자 계정을 찾을 수 없습니다.", status: 403 as const };
  }

  return { profile };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedDepartmentId = searchParams.get("departmentId");
  const requestedTeacherId = searchParams.get("teacherId");
  const studentQuery = searchParams.get("studentQuery")?.trim().toLowerCase() ?? "";

  const departmentQuery = supabaseAdmin
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const { data: departments, error: departmentsError } =
    admin.profile.role === "master"
      ? await departmentQuery
      : await departmentQuery.eq("id", admin.profile.department_id);

  if (departmentsError) {
    return NextResponse.json({ error: "가맹점 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const managedDepartments = departments ?? [];
  const selectedDepartment =
    managedDepartments.find((department) => department.id === requestedDepartmentId) ??
    managedDepartments[0] ??
    null;

  if (!selectedDepartment) {
    return NextResponse.json({
      departments: [],
      selectedDepartment: null,
      totalStudentPoints: 0,
      spentPurchasePoints: 0,
      accounts: [],
      teachers: [],
      selectedTeacher: null,
      teacherTransactions: [],
      students: [],
    });
  }

  const { data: studentsData, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, department_id, teacher_id, parent_phone, name, grade, points, is_active, created_at")
    .eq("department_id", selectedDepartment.id)
    .eq("is_active", true)
    .order("name");

  if (studentsError) {
    return NextResponse.json({ error: "학생 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const students = (studentsData ?? []) as StudentRow[];
  const filteredStudents = studentQuery
    ? students.filter(
        (student) =>
          student.name.toLowerCase().includes(studentQuery) ||
          student.parent_phone.replace(/\D/g, "").includes(studentQuery.replace(/\D/g, ""))
      )
    : students;

  const totalStudentPoints = students.reduce((sum, student) => sum + student.points, 0);

  const { data: purchaseTransactions, error: purchaseError } = await supabaseAdmin
    .from("point_transactions")
    .select("amount")
    .eq("department_id", selectedDepartment.id)
    .eq("transaction_type", "purchase")
    .lt("amount", 0);

  if (purchaseError) {
    return NextResponse.json({ error: "구매 포인트 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const spentPurchasePoints = (purchaseTransactions ?? []).reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0
  );

  const { data: teacherRows, error: teacherError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, login_id, manager_name, role")
    .eq("department_id", selectedDepartment.id)
    .eq("is_active", true)
    .in("role", ["manager", "staff"])
    .order("manager_name");

  if (teacherError) {
    return NextResponse.json({ error: "강사 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: accountRows, error: accountError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, login_id, manager_name, role")
    .eq("department_id", selectedDepartment.id)
    .eq("is_active", true)
    .order("manager_name");

  if (accountError) {
    return NextResponse.json({ error: "관리자 계정 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const { data: teacherTransactionsData, error: teacherTransactionsError } = await supabaseAdmin
    .from("point_transactions")
    .select("id, student_id, amount, reason, adjusted_by, created_at, students(name)")
    .eq("department_id", selectedDepartment.id)
    .gt("amount", 0)
    .not("adjusted_by", "is", null)
    .order("created_at", { ascending: false });

  if (teacherTransactionsError) {
    return NextResponse.json({ error: "강사별 포인트 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const allTeacherTransactions = (teacherTransactionsData ?? []) as TransactionRow[];
  const teachers = (teacherRows ?? []).map((teacher) => ({
    id: teacher.id,
    loginId: teacher.login_id,
    name: teacher.manager_name,
    role: teacher.role,
    totalAwardedPoints: allTeacherTransactions
      .filter((transaction) => transaction.adjusted_by === teacher.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  }));

  const selectedTeacher =
    teachers.find((teacher) => teacher.id === requestedTeacherId) ?? teachers[0] ?? null;
  const teacherTransactions = selectedTeacher
    ? allTeacherTransactions
        .filter((transaction) => transaction.adjusted_by === selectedTeacher.id)
        .map((transaction) => ({
          id: transaction.id,
          studentName: Array.isArray(transaction.students)
            ? transaction.students[0]?.name ?? "학생 미상"
            : transaction.students?.name ?? "학생 미상",
          reason: transaction.reason,
          amount: transaction.amount,
          createdAt: transaction.created_at,
        }))
    : [];

  return NextResponse.json({
    departments: managedDepartments,
    selectedDepartment,
    totalStudentPoints,
    spentPurchasePoints,
    accounts: (accountRows ?? []).map((account) => ({
      id: account.id,
      loginId: account.login_id,
      name: account.manager_name,
      role: account.role,
    })),
    teachers,
    selectedTeacher,
    teacherTransactions,
    students: filteredStudents.map((student) => ({
      id: student.id,
      departmentName: selectedDepartment.name,
      name: student.name,
      grade: student.grade,
      points: student.points,
      teacherName:
        teachers.find((teacher) => teacher.id === student.teacher_id)?.name ?? "담당 강사 없음",
    })),
  });
}
