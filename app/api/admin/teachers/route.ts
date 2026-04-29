import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const AUTH_EMAIL_DOMAIN = "@daddyslab.com";

type AdminProfile = {
  id: string;
  role: string;
  department_id: string;
};

async function getManagerProfile(request: NextRequest) {
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
    return { error: "강사 관리 권한이 없습니다.", status: 403 as const };
  }

  return { profile };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request: NextRequest) {
  const admin = await getManagerProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { start, end } = monthRange();
  const requestedDepartmentId = new URL(request.url).searchParams.get("departmentId")?.trim();
  const departmentId =
    admin.profile.role === "master"
      ? requestedDepartmentId ?? admin.profile.department_id
      : admin.profile.department_id;

  const { data: teacherRows, error: teacherError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, login_id, manager_name, role, is_active")
    .eq("department_id", departmentId)
    .in("role", ["manager", "staff"])
    .order("manager_name");

  if (teacherError) {
    return NextResponse.json({ error: "강사 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const teachers = teacherRows ?? [];
  const teacherIds = teachers.map((teacher) => teacher.id);

  const { data: transactionRows, error: transactionError } = teacherIds.length
    ? await supabaseAdmin
        .from("point_transactions")
        .select("id, student_id, amount, reason, adjusted_by, created_at, students(name, parent_phone, grade)")
        .eq("department_id", departmentId)
        .in("adjusted_by", teacherIds)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (transactionError) {
    return NextResponse.json({ error: "코인 내역을 불러오지 못했습니다." }, { status: 500 });
  }

  const transactions = transactionRows ?? [];
  const activeTeachers = teachers
    .filter((teacher) => teacher.is_active)
    .map((teacher) => {
      const teacherTransactions = transactions.filter(
        (transaction) => transaction.adjusted_by === teacher.id
      );

      return {
        id: teacher.id,
        loginId: teacher.login_id,
        name: teacher.manager_name,
        role: teacher.role,
        passwordLabel: `${teacher.login_id}(${teacher.manager_name})`,
        givenThisMonth: teacherTransactions
          .filter((transaction) => transaction.amount > 0)
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        recoveredThisMonth: Math.abs(
          teacherTransactions
            .filter((transaction) => transaction.amount < 0)
            .reduce((sum, transaction) => sum + transaction.amount, 0)
        ),
        transactions: teacherTransactions.map((transaction) => {
          const student = Array.isArray(transaction.students)
            ? transaction.students[0]
            : transaction.students;

          return {
            id: transaction.id,
            studentName: student?.name ?? "학생 미상",
            amount: transaction.amount,
            reason: transaction.reason,
            note: "",
            createdAt: transaction.created_at,
          };
        }),
      };
    });

  const retiredTeacherIds = teachers.filter((teacher) => !teacher.is_active).map((teacher) => teacher.id);
  const { data: retiredTransactions, error: retiredTransactionError } = retiredTeacherIds.length
    ? await supabaseAdmin
        .from("point_transactions")
        .select("student_id, amount, adjusted_by, students(name, parent_phone, grade)")
        .eq("department_id", departmentId)
        .in("adjusted_by", retiredTeacherIds)
    : { data: [], error: null };

  if (retiredTransactionError) {
    return NextResponse.json({ error: "퇴직 강사 내역을 불러오지 못했습니다." }, { status: 500 });
  }

  const retiredTeachers = teachers
    .filter((teacher) => !teacher.is_active)
    .map((teacher) => {
      const rows = (retiredTransactions ?? []).filter((row) => row.adjusted_by === teacher.id);
      const byStudent = new Map<string, {
        studentName: string;
        parentPhone: string;
        grade: string;
        points: number;
      }>();

      rows.forEach((row) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const key = row.student_id;
        const current = byStudent.get(key) ?? {
          studentName: student?.name ?? "학생 미상",
          parentPhone: student?.parent_phone ?? "-",
          grade: student?.grade ?? "-",
          points: 0,
        };
        current.points += row.amount;
        byStudent.set(key, current);
      });

      return {
        id: teacher.id,
        loginId: teacher.login_id,
        name: teacher.manager_name,
        role: teacher.role,
        students: Array.from(byStudent.values()),
      };
    });

  return NextResponse.json({ teachers: activeTeachers, retiredTeachers });
}

export async function POST(request: NextRequest) {
  const admin = await getManagerProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    departmentId?: string;
    loginId?: string;
    password?: string;
    name?: string;
  };
  const departmentId =
    admin.profile.role === "master"
      ? body.departmentId?.trim() ?? admin.profile.department_id
      : admin.profile.department_id;
  const loginId = body.loginId?.trim().toLowerCase();
  const password = body.password?.trim();
  const name = body.name?.trim();

  if (!loginId || loginId.length > 50 || !/^[a-z0-9._-]+$/.test(loginId)) {
    return NextResponse.json({ error: "ID는 영어 이름 기반으로 입력해주세요." }, { status: 400 });
  }

  if (!password || password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "PW는 6~72자로 입력해주세요." }, { status: 400 });
  }

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "본명은 1~50자로 입력해주세요." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("admin_profiles")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 ID입니다." }, { status: 409 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: `${loginId}${AUTH_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "강사 계정을 생성하지 못했습니다." },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabaseAdmin.from("admin_profiles").insert({
    login_id: loginId,
    manager_name: name,
    auth_user_id: authData.user.id,
    role: "staff",
    department_id: departmentId,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "강사 프로필을 생성하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const admin = await getManagerProfile(request);

  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as {
    teacherId?: string;
    departmentId?: string;
    loginId?: string;
    password?: string;
    retire?: boolean;
  };
  const teacherId = body.teacherId?.trim();
  const departmentId =
    admin.profile.role === "master"
      ? body.departmentId?.trim() ?? admin.profile.department_id
      : admin.profile.department_id;
  const loginId = body.loginId?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!teacherId) {
    return NextResponse.json({ error: "강사를 선택해주세요." }, { status: 400 });
  }

  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, auth_user_id, login_id")
    .eq("id", teacherId)
    .eq("department_id", departmentId)
    .eq("role", "staff")
    .single();

  if (teacherError || !teacher) {
    return NextResponse.json({ error: "강사를 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.retire) {
    const { error } = await supabaseAdmin
      .from("admin_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", teacherId);

    if (error) {
      return NextResponse.json({ error: "퇴사 등록에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (!loginId || loginId.length > 50 || !/^[a-z0-9._-]+$/.test(loginId)) {
    return NextResponse.json({ error: "강사 ID를 확인해주세요." }, { status: 400 });
  }

  if (!password || password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "강사 PW는 6~72자로 입력해주세요." }, { status: 400 });
  }

  if (loginId !== teacher.login_id) {
    const { data: existing } = await supabaseAdmin
      .from("admin_profiles")
      .select("id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 ID입니다." }, { status: 409 });
    }
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(teacher.auth_user_id, {
    email: `${loginId}${AUTH_EMAIL_DOMAIN}`,
    password,
  });

  if (authError) {
    return NextResponse.json(
      { error: authError.message || "강사 계정을 수정하지 못했습니다." },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabaseAdmin
    .from("admin_profiles")
    .update({ login_id: loginId, updated_at: new Date().toISOString() })
    .eq("id", teacherId);

  if (profileError) {
    return NextResponse.json({ error: "강사 프로필을 수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
