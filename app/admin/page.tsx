"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabase/client";

type AdminRole = "master" | "manager" | "staff";
type AdminView = "students" | "teachers" | "shop" | "departments" | "pins" | "announcements";

type AdminProfileRow = {
  id: string;
  login_id: string;
  manager_name: string;
  role: AdminRole;
  department_id: string;
  is_active: boolean;
  departments?: {
    name: string;
  } | null;
};

type AdminSession = {
  id: string;
  loginId: string;
  name: string;
  role: AdminRole;
  departmentId: string;
  departmentName: string;
};

type Department = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  department_id: string;
  teacher_id: string | null;
  parent_phone: string;
  name: string;
  grade: string;
  points: number;
  note: string;
  is_active: boolean;
  created_at: string;
};

type Product = {
  id: string;
  department_id: string;
  name: string;
  category: string | null;
  price_dp: number;
  stock: number;
  is_active: boolean;
  emoji: string | null;
  image_url: string | null;
};

type PinSetting = {
  setting_key: string;
  value: string;
};

type FranchiseSummary = {
  departments: Department[];
  selectedDepartment: Department | null;
  totalStudentPoints: number;
  spentPurchasePoints: number;
  accounts: Array<{
    id: string;
    loginId: string;
    name: string;
    role: string;
  }>;
  teachers: Array<{
    id: string;
    loginId: string;
    name: string;
    role: string;
    totalAwardedPoints: number;
  }>;
  selectedTeacher: {
    id: string;
    loginId: string;
    name: string;
    role: string;
    totalAwardedPoints: number;
  } | null;
  teacherTransactions: Array<{
    id: string;
    studentName: string;
    reason: string;
    amount: number;
    createdAt: string;
  }>;
  students: Array<{
    id: string;
    departmentName: string;
    name: string;
    grade: string;
    points: number;
    teacherName: string;
  }>;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

type TeacherTransaction = {
  id: string;
  studentName: string;
  amount: number;
  reason: string;
  note: string;
  createdAt: string;
};

type TeacherSummary = {
  id: string;
  loginId: string;
  name: string;
  role: string;
  passwordLabel: string;
  givenThisMonth: number;
  recoveredThisMonth: number;
  transactions: TeacherTransaction[];
};

type RetiredTeacherSummary = {
  id: string;
  loginId: string;
  name: string;
  role: string;
  students: Array<{
    studentName: string;
    parentPhone: string;
    grade: string;
    points: number;
  }>;
};

const AUTH_EMAIL_DOMAIN = "@daddyslab.com";
const SIGNUP_DEPARTMENTS = ["대치", "판교"];
const DEPARTMENT_PIN_PREFIX = "dept_pin:";
const PIN_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GRADE_OPTIONS = [
  "3세",
  "4세",
  "5세",
  "6세",
  "7세",
  "초1",
  "초2",
  "초3",
  "초4",
  "초5",
  "초6",
  "중1",
  "중2",
  "중3",
  "고1",
  "고2",
  "고3",
  "성인",
] as const;
const KOREA_TIME_ZONE = "Asia/Seoul";

const ROLE_LABELS: Record<AdminRole, string> = {
  master: "마스터",
  manager: "매니저",
  staff: "스태프",
};

const FRANCHISE_MEMBER_ROLE_LABELS: Record<string, string> = {
  manager: "랩장",
  staff: "강사",
};

function getKoreaYear(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: KOREA_TIME_ZONE,
      year: "numeric",
    }).format(date)
  );
}

function getPromotedGrade(grade: string, createdAt: string) {
  const gradeIndex = GRADE_OPTIONS.findIndex((option) => option === grade);

  if (gradeIndex < 0 || grade === "성인") {
    return grade;
  }

  const currentYear = getKoreaYear(new Date());
  const createdYear = getKoreaYear(new Date(createdAt));
  const nextIndex = Math.min(gradeIndex + Math.max(0, currentYear - createdYear), GRADE_OPTIONS.length - 1);

  return GRADE_OPTIONS[nextIndex];
}

function formatKoreaDate(date: Date | string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function normalizeExcelGrade(value: string) {
  const grade = value.trim();

  if (GRADE_OPTIONS.includes(grade as (typeof GRADE_OPTIONS)[number])) {
    return grade;
  }

  const elementaryMatch = grade.match(/^([1-6])\s*학년$/);

  if (elementaryMatch) {
    return `초${elementaryMatch[1]}`;
  }

  const ageMatch = grade.match(/^([3-7])\s*세?$/);

  if (ageMatch) {
    return `${ageMatch[1]}세`;
  }

  return grade;
}

function pickExcelValue(row: Record<string, string | number>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [activeView, setActiveView] = useState<AdminView>("students");
  const [message, setMessage] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [signupId, setSignupId] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupDepartment, setSignupDepartment] = useState(SIGNUP_DEPARTMENTS[0]);
  const [signupPin, setSignupPin] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productEmoji, setProductEmoji] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [pinSettings, setPinSettings] = useState<Record<string, string>>({});
  const [savedPinDepartments, setSavedPinDepartments] = useState<Set<string>>(new Set());
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [savingPinDepartmentId, setSavingPinDepartmentId] = useState<string | null>(null);
  const [copiedPinDepartment, setCopiedPinDepartment] = useState<string | null>(null);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentOwnerName, setNewDepartmentOwnerName] = useState("");
  const [newDepartmentManagerId, setNewDepartmentManagerId] = useState("");
  const [newDepartmentManagerPassword, setNewDepartmentManagerPassword] = useState("");
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [selectedFranchiseTeacherId, setSelectedFranchiseTeacherId] = useState("");
  const [franchiseStudentSearchText, setFranchiseStudentSearchText] = useState("");
  const [submittedFranchiseStudentSearchText, setSubmittedFranchiseStudentSearchText] =
    useState("");
  const [franchiseSummary, setFranchiseSummary] = useState<FranchiseSummary | null>(null);
  const [isLoadingFranchiseSummary, setIsLoadingFranchiseSummary] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [credentialLoginId, setCredentialLoginId] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState("");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [checkedStudentIds, setCheckedStudentIds] = useState<Set<string>>(new Set());
  const [studentSearchText, setStudentSearchText] = useState("");
  const [submittedStudentSearchText, setSubmittedStudentSearchText] = useState("");
  const [pointAmount, setPointAmount] = useState("");
  const [pointReason, setPointReason] = useState("포인트 조정");
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [batchPointMode, setBatchPointMode] = useState<"give" | "recover" | null>(null);
  const [batchPointAmount, setBatchPointAmount] = useState("");
  const [batchPointReason, setBatchPointReason] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
  const [isDraggingStudentFile, setIsDraggingStudentFile] = useState(false);
  const [teacherTab, setTeacherTab] = useState<"manage" | "create" | "retired">("manage");
  const [teacherSummaries, setTeacherSummaries] = useState<TeacherSummary[]>([]);
  const [retiredTeacherSummaries, setRetiredTeacherSummaries] = useState<RetiredTeacherSummary[]>([]);
  const [expandedTeacherId, setExpandedTeacherId] = useState<string>("");
  const [selectedRetiredTeacherId, setSelectedRetiredTeacherId] = useState<string>("");
  const [newTeacherLoginId, setNewTeacherLoginId] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<TeacherSummary | null>(null);
  const [teacherEditLoginId, setTeacherEditLoginId] = useState("");
  const [teacherEditPassword, setTeacherEditPassword] = useState("");
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [announcementMode, setAnnouncementMode] = useState<"create" | "edit">("create");
  const [announcementOrder, setAnnouncementOrder] = useState<"latest" | "oldest">("latest");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementContent, setAnnouncementContent] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementContent, setEditingAnnouncementContent] = useState("");
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);

  const departmentNameById = useMemo(() => {
    return new Map(departments.map((department) => [department.id, department.name]));
  }, [departments]);

  const hasSelectedFranchise = session?.role !== "master" || Boolean(selectedFranchiseId);
  const canUseShop = (session?.role === "master" || session?.role === "manager") && hasSelectedFranchise;
  const canManageTeachers =
    (session?.role === "master" || session?.role === "manager") && hasSelectedFranchise;
  const canManageFranchises = session?.role === "master";
  const canMutateFranchises = session?.role === "master";
  const scopeLabel =
    session?.role === "master"
      ? selectedFranchiseId
        ? `${departmentNameById.get(selectedFranchiseId) ?? "선택 가맹점"} 가맹점`
        : "가맹점을 선택하세요"
      : session
        ? `${session.departmentName} 가맹점`
        : "";

  const navItems = useMemo(
    () =>
      [
        { id: "departments" as const, label: "가맹점 관리", allowed: canManageFranchises },
        { id: "students" as const, label: "학생 관리", allowed: session?.role !== "master" || hasSelectedFranchise },
        { id: "teachers" as const, label: "강사 관리", allowed: canManageTeachers },
        { id: "shop" as const, label: "상점 관리", allowed: canUseShop },
        { id: "pins" as const, label: "PIN 관리", allowed: canMutateFranchises },
        { id: "announcements" as const, label: "공지 관리", allowed: canMutateFranchises },
      ].filter((item) => item.allowed),
    [canManageFranchises, canManageTeachers, canMutateFranchises, canUseShop, hasSelectedFranchise, session?.role]
  );

  const scopedStudents = useMemo(() => {
    if (session?.role === "master" && selectedFranchiseId) {
      return students.filter((student) => student.department_id === selectedFranchiseId);
    }

    return students;
  }, [selectedFranchiseId, session?.role, students]);
  const scopedProducts = useMemo(() => {
    if (session?.role === "master" && selectedFranchiseId) {
      return products.filter((product) => product.department_id === selectedFranchiseId);
    }

    return products;
  }, [products, selectedFranchiseId, session?.role]);
  const checkedStudents = scopedStudents.filter((student) => checkedStudentIds.has(student.id));
  const selectedStudent = checkedStudents.length === 1 ? checkedStudents[0] : null;
  const displayedStudents = useMemo(() => {
    const query = submittedStudentSearchText.trim().toLowerCase();

    if (!query) {
      return scopedStudents;
    }

    return scopedStudents.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.parent_phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""))
      );
    });
  }, [scopedStudents, submittedStudentSearchText]);

  const loadAdminData = async (currentSession: AdminSession) => {
    setIsLoadingData(true);
    setDataMessage("");

    const { data: departmentRows, error: departmentError } = await supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (departmentError) {
      setDataMessage("가맹점 정보를 불러오지 못했습니다.");
      setIsLoadingData(false);
      return;
    }

    const productQuery = supabase
      .from("products")
      .select("id, department_id, name, category, price_dp, stock, is_active, emoji, image_url")
      .order("created_at", { ascending: false });

    const { data: productRows, error: productError } =
      currentSession.role === "master"
        ? await productQuery
        : await productQuery.eq("department_id", currentSession.departmentId);

    if (productError) {
      setDataMessage("상점 정보를 불러오지 못했습니다.");
      setIsLoadingData(false);
      return;
    }

    const { data: studentRows, error: studentError } =
      currentSession.role === "master"
        ? await supabase
            .from("students")
            .select("id, department_id, teacher_id, parent_phone, name, grade, points, note, is_active, created_at")
            .order("created_at", { ascending: false })
        : await supabase
            .from("students")
            .select("id, department_id, teacher_id, parent_phone, name, grade, points, note, is_active, created_at")
            .eq("department_id", currentSession.departmentId)
            .order("created_at", { ascending: false });

    if (studentError) {
      setDataMessage("학생 정보를 불러오지 못했습니다.");
      setIsLoadingData(false);
      return;
    }

    setDepartments(departmentRows ?? []);
    setSelectedFranchiseId(currentSession.role === "master" ? "" : currentSession.departmentId);
    setProducts(productRows ?? []);
    setStudents(studentRows ?? []);
    setSelectedStudentId((studentRows ?? [])[0]?.id ?? "");
    setCheckedStudentIds(new Set());
    setSubmittedStudentSearchText("");

    if (currentSession.role === "master") {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/pins", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
      });

      if (!response.ok) {
        setDataMessage("PIN 설정을 불러오지 못했습니다.");
      } else {
        const payload = (await response.json()) as { pins?: PinSetting[] };
        const nextPinSettings = Object.fromEntries(
          (payload.pins ?? []).map((setting) => [
            setting.setting_key.replace(DEPARTMENT_PIN_PREFIX, ""),
            setting.value,
          ])
        );
        setPinSettings(nextPinSettings);
        setSavedPinDepartments(new Set(Object.keys(nextPinSettings)));
      }
    } else {
      setPinSettings({});
      setSavedPinDepartments(new Set());
    }

    await loadStudentNotes();
    setIsLoadingData(false);
  };

  const loadStudentNotes = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/student-notes", {
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { notes?: Record<string, string> };
    setStudentNotes(payload.notes ?? {});
  };

  const loadFranchiseSummary = async ({
    departmentId,
    teacherId,
    studentQuery,
  }: {
    departmentId?: string;
    teacherId?: string;
    studentQuery?: string;
  } = {}) => {
    setIsLoadingFranchiseSummary(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const params = new URLSearchParams();

    if (departmentId) {
      params.set("departmentId", departmentId);
    }

    if (teacherId) {
      params.set("teacherId", teacherId);
    }

    if (studentQuery) {
      params.set("studentQuery", studentQuery);
    }

    const response = await fetch(`/api/admin/franchises/summary?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "가맹점 요약 정보를 불러오지 못했습니다.");
      setIsLoadingFranchiseSummary(false);
      return;
    }

    const payload = (await response.json()) as FranchiseSummary;
    setFranchiseSummary(payload);
    setSelectedFranchiseId(payload.selectedDepartment?.id ?? "");
    setSelectedFranchiseTeacherId(payload.selectedTeacher?.id ?? "");
    setIsLoadingFranchiseSummary(false);
  };

  const loadAnnouncements = async (order = announcementOrder) => {
    setIsLoadingAnnouncements(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/announcements?order=${order}`, {
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "공지를 불러오지 못했습니다.");
      setIsLoadingAnnouncements(false);
      return;
    }

    const payload = (await response.json()) as { announcements?: Announcement[] };
    setAnnouncements(payload.announcements ?? []);
    setIsLoadingAnnouncements(false);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsLoggingIn(true);

    const normalizedLoginId = loginId.trim().toLowerCase();
    const email = `${normalizedLoginId}${AUTH_EMAIL_DOMAIN}`;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: loginPassword,
    });

    if (authError || !authData.user) {
      setMessage("아이디 또는 비밀번호를 다시 확인해주세요.");
      setIsLoggingIn(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("id, login_id, manager_name, role, department_id, is_active, departments(name)")
      .eq("auth_user_id", authData.user.id)
      .eq("login_id", normalizedLoginId)
      .eq("is_active", true)
      .single<AdminProfileRow>();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setMessage("활성화된 관리자 계정을 찾을 수 없습니다.");
      setIsLoggingIn(false);
      return;
    }

    const nextSession = {
      id: profile.id,
      loginId: profile.login_id,
      name: profile.manager_name,
      role: profile.role,
      departmentId: profile.department_id,
      departmentName: profile.departments?.name ?? "가맹점 미지정",
    };

    setSession(nextSession);
    if (nextSession.role === "master") {
      setActiveView("departments");
    } else {
      setActiveView("students");
    }
    setLoginPassword("");
    setIsLoggingIn(false);
    await loadAdminData(nextSession);
    if (nextSession.role === "manager") {
      await loadFranchiseSummary({
        departmentId: nextSession.departmentId,
      });
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const normalizedSignupId = signupId.trim().toLowerCase();
    const email = `${normalizedSignupId}${AUTH_EMAIL_DOMAIN}`;

    if (!normalizedSignupId) {
      setMessage("아이디를 입력해주세요.");
      return;
    }

    if (signupPassword.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (signupPassword !== signupConfirm) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSigningUp(true);

    const { data: department, error: departmentError } = await supabase
      .from("departments")
      .select("id")
      .eq("name", signupDepartment)
      .single();

    if (departmentError || !department) {
      setMessage("가입할 가맹점을 찾을 수 없습니다.");
      setIsSigningUp(false);
      return;
    }

    const { data: pinSetting, error: pinSettingError } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("setting_key", `${DEPARTMENT_PIN_PREFIX}${signupDepartment}`)
      .single();

    if (pinSettingError || !pinSetting || pinSetting.value !== signupPin.trim().toUpperCase()) {
      setMessage("관리자 가입 PIN이 올바르지 않습니다.");
      setIsSigningUp(false);
      return;
    }

    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password: signupPassword,
    });

    if (signupError || !authData.user) {
      setMessage("이미 사용 중인 아이디이거나 가입할 수 없는 계정입니다.");
      setIsSigningUp(false);
      return;
    }

    const { error: profileError } = await supabase.from("admin_profiles").insert({
      login_id: normalizedSignupId,
      manager_name: signupName.trim(),
      auth_user_id: authData.user.id,
      role: "staff",
      department_id: department.id,
    });

    if (profileError) {
      setMessage("Auth 계정은 생성되었지만 관리자 프로필 생성에 실패했습니다.");
      setIsSigningUp(false);
      return;
    }

    await supabase.auth.signOut();
    setLoginId(normalizedSignupId);
    setLoginPassword("");
    setSignupId("");
    setSignupPassword("");
    setSignupConfirm("");
    setSignupName("");
    setSignupDepartment(SIGNUP_DEPARTMENTS[0]);
    setSignupPin("");
    setAuthMode("login");
    setMessage("회원가입이 완료되었습니다. 승인된 권한으로 로그인해주세요.");
    setIsSigningUp(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStudents([]);
    setProducts([]);
    setDepartments([]);
    setPinSettings({});
    setSavedPinDepartments(new Set());
    setCopiedPinDepartment(null);
    setSelectedStudentId("");
    setCheckedStudentIds(new Set());
    setSubmittedStudentSearchText("");
    setStudentSearchText("");
    setActiveView("students");
    setNewDepartmentName("");
    setIsDepartmentModalOpen(false);
  };

  const saveStudents = async (studentRows: Array<Pick<Student, "name" | "grade" | "parent_phone">>) => {
    if (!studentRows.length) {
      setDataMessage("추가할 학생 정보가 없습니다.");
      return false;
    }

    const invalidGrade = studentRows.find(
      (student) => !GRADE_OPTIONS.includes(student.grade as (typeof GRADE_OPTIONS)[number])
    );

    if (invalidGrade) {
      setDataMessage("학년은 정해진 목록 중에서 선택해주세요.");
      return false;
    }

    setIsSavingStudent(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/students", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        departmentId: session?.role === "master" ? selectedFranchiseId : session?.departmentId,
        students: studentRows,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "학생을 추가하지 못했습니다.");
      setIsSavingStudent(false);
      return false;
    }

    const payload = (await response.json()) as { students?: Student[] };
    const savedStudents = payload.students ?? [];
    setStudents((currentStudents) => [...savedStudents, ...currentStudents]);
    setSelectedStudentId(savedStudents[0]?.id ?? selectedStudentId);
    setSubmittedStudentSearchText("");
    setDataMessage(`${savedStudents.length}명의 학생을 추가했습니다.`);
    setIsSavingStudent(false);
    return true;
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const didSave = await saveStudents([
      {
        name: newStudentName,
        grade: newStudentGrade,
        parent_phone: newStudentPhone,
      },
    ]);

    if (didSave) {
      setNewStudentName("");
      setNewStudentGrade("");
      setNewStudentPhone("");
      setIsStudentModalOpen(false);
    }
  };

  const handleStudentSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedStudentSearchText(studentSearchText);
    setCheckedStudentIds(new Set());
  };

  const handleStudentCheck = (studentId: string, checked: boolean) => {
    setCheckedStudentIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (checked) {
        nextIds.add(studentId);
      } else {
        nextIds.delete(studentId);
      }

      return nextIds;
    });
  };

  const handleToggleAllStudents = (checked: boolean) => {
    setCheckedStudentIds(
      checked ? new Set(displayedStudents.map((student) => student.id)) : new Set()
    );
  };

  const handleDeleteCheckedStudents = async () => {
    const studentIds = [...checkedStudentIds];

    if (!studentIds.length) {
      setDataMessage("삭제할 학생을 선택해주세요.");
      return;
    }

    setIsDeletingStudents(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/students", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ studentIds }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "학생을 삭제하지 못했습니다.");
      setIsDeletingStudents(false);
      return;
    }

    setStudents((currentStudents) =>
      currentStudents.map((student) =>
        checkedStudentIds.has(student.id) ? { ...student, is_active: false } : student
      )
    );
    setCheckedStudentIds(new Set());
    setDataMessage(`${studentIds.length}명의 학생을 삭제했습니다.`);
    setIsDeletingStudents(false);
  };

  const handleAddDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session || session.role !== "master") {
      return;
    }

    const name = newDepartmentName.trim();
    const managerName = newDepartmentOwnerName.trim();
    const managerLoginId = newDepartmentManagerId.trim().toLowerCase();
    const managerPassword = newDepartmentManagerPassword;

    if (!name) {
      setDataMessage("추가할 가맹점명을 입력해주세요.");
      return;
    }

    if (!managerName) {
      setDataMessage("가맹점 주인 이름을 입력해주세요.");
      return;
    }

    if (!managerLoginId) {
      setDataMessage("manager ID를 입력해주세요.");
      return;
    }

    if (managerPassword.length < 6) {
      setDataMessage("manager PW는 6자 이상이어야 합니다.");
      return;
    }

    setIsSavingDepartment(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/departments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        name,
        managerName,
        managerLoginId,
        managerPassword,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "가맹점을 추가하지 못했습니다.");
      setIsSavingDepartment(false);
      return;
    }

    setNewDepartmentName("");
    setNewDepartmentOwnerName("");
    setNewDepartmentManagerId("");
    setNewDepartmentManagerPassword("");
    setIsDepartmentModalOpen(false);
    setDataMessage("가맹점을 생성했습니다.");
    setIsSavingDepartment(false);
    await loadAdminData(session);
    await loadFranchiseSummary({
      departmentId: selectedFranchiseId || undefined,
      teacherId: selectedFranchiseTeacherId || undefined,
      studentQuery: submittedFranchiseStudentSearchText,
    });
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!session || session.role !== "master") {
      return;
    }

    setDeletingDepartmentId(departmentId);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/departments?departmentId=${departmentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "가맹점을 삭제하지 못했습니다.");
      setDeletingDepartmentId(null);
      return;
    }

    setDataMessage("가맹점을 삭제했습니다.");
    setDeletingDepartmentId(null);
    await loadAdminData(session);
    await loadFranchiseSummary({
      departmentId: selectedFranchiseId === departmentId ? undefined : selectedFranchiseId,
      teacherId: selectedFranchiseTeacherId || undefined,
      studentQuery: submittedFranchiseStudentSearchText,
    });
  };

  const handleResetAdminPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session || session.role !== "master" || !franchiseSummary?.selectedTeacher) {
      return;
    }

    if (resetPassword.length < 6) {
      setDataMessage("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setDataMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsResettingPassword(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        adminProfileId: franchiseSummary.selectedTeacher.id,
        password: resetPassword,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "비밀번호를 변경하지 못했습니다.");
      setIsResettingPassword(false);
      return;
    }

    setResetPassword("");
    setResetPasswordConfirm("");
    setDataMessage(`${franchiseSummary.selectedTeacher.name} 비밀번호를 변경했습니다.`);
    setIsResettingPassword(false);
  };

  const openCreateProductModal = () => {
    setProductModalMode("create");
    setEditingProduct(null);
    setProductEmoji("");
    setProductImageUrl("");
    setProductName("");
    setProductPrice("");
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setProductModalMode("edit");
    setEditingProduct(product);
    setProductEmoji(product.emoji ?? "");
    setProductImageUrl(product.image_url ?? "");
    setProductName(product.name);
    setProductPrice(String(product.price_dp));
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductEmoji("");
    setProductImageUrl("");
    setProductName("");
    setProductPrice("");
  };

  const handleProductImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProductImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session || !["master", "manager"].includes(session.role)) {
      return;
    }

    const productDepartmentId =
      session.role === "master" ? selectedFranchiseId : session.departmentId;

    if (!productDepartmentId) {
      setDataMessage("가맹점을 먼저 선택해주세요.");
      return;
    }

    const priceDp = Number(productPrice);

    if (!productName.trim()) {
      setDataMessage("상품 이름을 입력해주세요.");
      return;
    }

    if (!Number.isInteger(priceDp) || priceDp < 0) {
      setDataMessage("상품 가격은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    setIsSavingProduct(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/products", {
      method: productModalMode === "create" ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        id: editingProduct?.id,
        departmentId: productDepartmentId,
        emoji: productEmoji,
        imageUrl: productImageUrl,
        name: productName,
        priceDp,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "상품을 저장하지 못했습니다.");
      setIsSavingProduct(false);
      return;
    }

    const payload = (await response.json()) as { product: Product };
    setProducts((currentProducts) =>
      productModalMode === "create"
        ? [payload.product, ...currentProducts]
        : currentProducts.map((product) =>
            product.id === payload.product.id ? payload.product : product
          )
    );
    setDataMessage(productModalMode === "create" ? "상품을 추가했습니다." : "상품을 수정했습니다.");
    setIsSavingProduct(false);
    closeProductModal();
  };

  const loadTeacherData = async () => {
    if (!session || !["master", "manager"].includes(session.role)) {
      return;
    }

    const departmentId = session.role === "master" ? selectedFranchiseId : session.departmentId;

    if (!departmentId) {
      setDataMessage("가맹점을 먼저 선택해주세요.");
      return;
    }

    setIsLoadingTeachers(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/teachers?departmentId=${departmentId}`, {
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "강사 정보를 불러오지 못했습니다.");
      setIsLoadingTeachers(false);
      return;
    }

    const payload = (await response.json()) as {
      teachers: TeacherSummary[];
      retiredTeachers: RetiredTeacherSummary[];
    };
    setTeacherSummaries(payload.teachers ?? []);
    setRetiredTeacherSummaries(payload.retiredTeachers ?? []);
    setExpandedTeacherId((current) => current || payload.teachers?.[0]?.id || "");
    setSelectedRetiredTeacherId((current) => current || payload.retiredTeachers?.[0]?.id || "");
    setIsLoadingTeachers(false);
  };

  const handleAddTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newTeacherLoginId.trim() || !newTeacherPassword.trim() || !newTeacherName.trim()) {
      setDataMessage("강사 ID, PW, 본명을 모두 입력해주세요.");
      return;
    }

    const departmentId = session?.role === "master" ? selectedFranchiseId : session?.departmentId;

    if (!departmentId) {
      setDataMessage("가맹점을 먼저 선택해주세요.");
      return;
    }

    setIsSavingTeacher(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        loginId: newTeacherLoginId,
        password: newTeacherPassword,
        name: newTeacherName,
        departmentId,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "강사를 추가하지 못했습니다.");
      setIsSavingTeacher(false);
      return;
    }

    setNewTeacherLoginId("");
    setNewTeacherPassword("");
    setNewTeacherName("");
    setDataMessage("강사를 추가했습니다.");
    setIsSavingTeacher(false);
    setTeacherTab("manage");
    await loadTeacherData();
  };

  const openTeacherEditModal = (teacher: TeacherSummary) => {
    setEditingTeacher(teacher);
    setTeacherEditLoginId(teacher.loginId);
    setTeacherEditPassword("");
  };

  const closeTeacherEditModal = () => {
    setEditingTeacher(null);
    setTeacherEditLoginId("");
    setTeacherEditPassword("");
  };

  const handleUpdateTeacher = async (retire = false) => {
    if (!editingTeacher) {
      return;
    }

    const departmentId = session?.role === "master" ? selectedFranchiseId : session?.departmentId;

    if (!retire && (!teacherEditLoginId.trim() || teacherEditPassword.trim().length < 6)) {
      setDataMessage("강사 ID와 6자 이상의 PW를 입력해주세요.");
      return;
    }

    setIsSavingTeacher(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        teacherId: editingTeacher.id,
        loginId: teacherEditLoginId,
        password: teacherEditPassword,
        departmentId,
        retire,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "강사 정보를 수정하지 못했습니다.");
      setIsSavingTeacher(false);
      return;
    }

    setDataMessage(retire ? "강사를 등록 해제했습니다." : "강사 정보를 수정했습니다.");
    setIsSavingTeacher(false);
    closeTeacherEditModal();
    await loadTeacherData();
  };

  const getCredentialTarget = () =>
    franchiseSummary?.accounts.find((account) => account.role === "manager") ??
    franchiseSummary?.accounts[0] ??
    null;

  const handleOpenCredentialModal = () => {
    const target = getCredentialTarget();

    if (!target) {
      setDataMessage("확인할 manager 계정이 없습니다.");
      return;
    }

    setCredentialLoginId(target.loginId);
    setCredentialPassword("");
    setIsEditingCredentials(false);
    setIsCredentialModalOpen(true);
  };

  const handleCloseCredentialModal = () => {
    setCredentialLoginId("");
    setCredentialPassword("");
    setIsEditingCredentials(false);
    setIsCredentialModalOpen(false);
  };

  const handleCancelCredentialEdit = () => {
    const target = getCredentialTarget();

    setCredentialLoginId(target?.loginId ?? "");
    setCredentialPassword("");
    setIsEditingCredentials(false);
  };

  const handleUpdateCredentials = async () => {
    if (!session || session.role !== "master") {
      return;
    }

    const target = getCredentialTarget();
    const nextLoginId = credentialLoginId.trim().toLowerCase();
    const nextPassword = credentialPassword.trim();

    if (!target) {
      setDataMessage("변경할 manager 계정이 없습니다.");
      return;
    }

    if (!nextLoginId) {
      setDataMessage("manager ID를 입력해주세요.");
      return;
    }

    if (nextPassword.length < 6) {
      setDataMessage("manager PW는 6자 이상이어야 합니다.");
      return;
    }

    setIsSavingCredentials(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        adminProfileId: target.id,
        loginId: nextLoginId,
        password: nextPassword,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "manager 계정을 변경하지 못했습니다.");
      setIsSavingCredentials(false);
      return;
    }

    setCredentialLoginId(nextLoginId);
    setCredentialPassword("");
    setIsEditingCredentials(false);
    setIsSavingCredentials(false);
    setDataMessage("manager 계정을 변경했습니다.");
    await loadFranchiseSummary({
      departmentId: selectedFranchiseId || undefined,
      teacherId: selectedFranchiseTeacherId || undefined,
      studentQuery: submittedFranchiseStudentSearchText,
    });
  };

  const handlePinChange = (departmentName: string, nextPin: string) => {
    setPinSettings((currentSettings) => ({
      ...currentSettings,
      [departmentName]: nextPin
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12),
    }));
  };

  const handleGeneratePin = (departmentName: string) => {
    const nextPin = Array.from(
      { length: 8 },
      () => PIN_CHARACTERS[Math.floor(Math.random() * PIN_CHARACTERS.length)]
    ).join("");
    handlePinChange(departmentName, nextPin);
  };

  const handleSavePin = async (departmentName: string) => {
    if (!session || session.role !== "master") {
      return;
    }

    const pin = pinSettings[departmentName]?.trim().toUpperCase();

    if (!pin || pin.length < 8) {
      setDataMessage("PIN은 영문/숫자 조합 8자리 이상으로 입력해주세요.");
      return;
    }

    setSavingPinDepartmentId(departmentName);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/pins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ departmentName, pin }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "PIN을 저장하지 못했습니다.");
    } else {
      setSavedPinDepartments((currentDepartments) => {
        const nextDepartments = new Set(currentDepartments);
        nextDepartments.add(departmentName);
        return nextDepartments;
      });
      setDataMessage("가맹점 PIN을 저장했습니다.");
    }

    setSavingPinDepartmentId(null);
  };

  const handleCopyPin = async (departmentName: string) => {
    const pin = pinSettings[departmentName]?.trim();

    if (!pin) {
      setDataMessage("복사할 PIN이 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(pin);
      setCopiedPinDepartment(departmentName);
      setDataMessage("PIN을 복사했습니다.");
    } catch {
      setDataMessage("PIN을 복사하지 못했습니다.");
    }
  };

  const resetAnnouncementDraft = () => {
    setAnnouncementContent("");
    setEditingAnnouncementId(null);
    setEditingAnnouncementContent("");
  };

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!announcementContent.trim()) {
      setDataMessage("공지 내용을 입력해주세요.");
      return;
    }

    setIsSavingAnnouncement(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ content: announcementContent }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "공지를 저장하지 못했습니다.");
      setIsSavingAnnouncement(false);
      return;
    }

    setAnnouncementContent("");
    setDataMessage("공지를 등록했습니다.");
    setIsSavingAnnouncement(false);
    await loadAnnouncements();
  };

  const handleUpdateAnnouncement = async (announcementId: string) => {
    if (!editingAnnouncementContent.trim()) {
      setDataMessage("공지 내용을 입력해주세요.");
      return;
    }

    setIsSavingAnnouncement(true);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ id: announcementId, content: editingAnnouncementContent }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "공지를 수정하지 못했습니다.");
      setIsSavingAnnouncement(false);
      return;
    }

    setEditingAnnouncementId(null);
    setEditingAnnouncementContent("");
    setDataMessage("공지를 수정했습니다.");
    setIsSavingAnnouncement(false);
    await loadAnnouncements();
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    setDeletingAnnouncementId(announcementId);
    setDataMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/announcements?id=${announcementId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setDataMessage(payload?.error ?? "공지를 삭제하지 못했습니다.");
      setDeletingAnnouncementId(null);
      return;
    }

    setDeletingAnnouncementId(null);
    setDataMessage("공지를 삭제했습니다.");
    await loadAnnouncements();
  };

  const handlePointAdjustment = async () => {
    if (!session || !selectedStudent) {
      return;
    }

    const parsedAmount = Number(pointAmount);

    if (!Number.isInteger(parsedAmount) || parsedAmount === 0) {
      setDataMessage("조정할 포인트는 양수 또는 음수 정수로 입력해주세요.");
      return;
    }

    const nextBalance = selectedStudent.points + parsedAmount;

    if (nextBalance < 0) {
      setDataMessage("DP가 0보다 작습니다.");
      return;
    }

    setIsAdjustingPoints(true);
    setDataMessage("");

    const { error: updateError } = await supabase
      .from("students")
      .update({ points: nextBalance })
      .eq("id", selectedStudent.id);

    if (updateError) {
      setDataMessage("포인트를 수정하지 못했습니다.");
      setIsAdjustingPoints(false);
      return;
    }

    const { error: transactionError } = await supabase.from("point_transactions").insert({
      student_id: selectedStudent.id,
      department_id: selectedStudent.department_id,
      amount: parsedAmount,
      balance_after: nextBalance,
      transaction_type: "etc",
      reason: pointReason.trim() || "포인트 조정",
      adjusted_by: session.id,
    });

    if (transactionError) {
      setDataMessage("포인트는 수정했지만 이력 저장에 실패했습니다.");
    } else {
      setDataMessage(`${selectedStudent.name} 학생의 포인트를 변경했습니다.`);
    }

    setStudents((currentStudents) =>
      currentStudents.map((student) =>
        student.id === selectedStudent.id ? { ...student, points: nextBalance } : student
      )
    );
    setIsAdjustingPoints(false);
  };

  const handleDirectedPointAdjustment = async (student: Student, direction: "give" | "recover") => {
    const absAmount = Math.abs(Number(pointAmount));
    const signedAmount = direction === "give" ? absAmount : -absAmount;

    setCheckedStudentIds(new Set([student.id]));
    setPointAmount(String(signedAmount));

    if (!Number.isInteger(absAmount) || absAmount === 0) {
      setDataMessage("포인트를 입력하고 지급 또는 회수 버튼을 눌러주세요.");
      return;
    }

    const nextBalance = student.points + signedAmount;

    if (nextBalance < 0) {
      setDataMessage("DP가 0보다 작아질 수 없습니다.");
      return;
    }

    setIsAdjustingPoints(true);
    setDataMessage("");

    const { error: updateError } = await supabase
      .from("students")
      .update({ points: nextBalance })
      .eq("id", student.id);

    if (updateError) {
      setDataMessage("포인트를 수정하지 못했습니다.");
      setIsAdjustingPoints(false);
      return;
    }

    const { error: transactionError } = await supabase.from("point_transactions").insert({
      student_id: student.id,
      department_id: student.department_id,
      amount: signedAmount,
      balance_after: nextBalance,
      transaction_type: "etc",
      reason: pointReason.trim() || "포인트 조정",
      adjusted_by: session?.id,
    });

    setStudents((currentStudents) =>
      currentStudents.map((currentStudent) =>
        currentStudent.id === student.id ? { ...currentStudent, points: nextBalance } : currentStudent
      )
    );
    setDataMessage(
      transactionError
        ? "포인트는 수정했지만 이력 저장에 실패했습니다."
        : `${student.name} 학생의 포인트를 변경했습니다.`
    );
    setIsAdjustingPoints(false);
  };

  const handleBatchPointAdjustment = async () => {
    if (!session || !batchPointMode || !checkedStudentIds.size) {
      return;
    }

    const absAmount = Math.abs(Number(batchPointAmount));

    if (!Number.isInteger(absAmount) || absAmount === 0) {
      setDataMessage("일괄 조정할 포인트를 입력해주세요.");
      return;
    }

    const signedAmount = batchPointMode === "give" ? absAmount : -absAmount;
    const targets = students.filter((student) => checkedStudentIds.has(student.id));

    if (targets.some((student) => student.points + signedAmount < 0)) {
      setDataMessage("회수 후 포인트가 0보다 작아지는 학생이 있습니다.");
      return;
    }

    setIsAdjustingPoints(true);
    setDataMessage("");

    for (const student of targets) {
      const nextBalance = student.points + signedAmount;
      const { error: updateError } = await supabase
        .from("students")
        .update({ points: nextBalance })
        .eq("id", student.id);

      if (updateError) {
        setDataMessage("일괄 포인트 조정 중 오류가 발생했습니다.");
        setIsAdjustingPoints(false);
        return;
      }

      await supabase.from("point_transactions").insert({
        student_id: student.id,
        department_id: student.department_id,
        amount: signedAmount,
        balance_after: nextBalance,
        transaction_type: "etc",
        reason: batchPointReason.trim() || pointReason.trim() || "포인트 조정",
        adjusted_by: session.id,
      });
    }

    setStudents((currentStudents) =>
      currentStudents.map((student) =>
        checkedStudentIds.has(student.id)
          ? { ...student, points: student.points + signedAmount }
          : student
      )
    );
    setBatchPointMode(null);
    setBatchPointAmount("");
    setBatchPointReason("");
    setDataMessage(`${targets.length}명에게 포인트를 일괄 변경했습니다.`);
    setIsAdjustingPoints(false);
  };

  const handleStudentNoteChange = async (studentId: string, note: string) => {
    setStudentNotes((currentNotes) => ({ ...currentNotes, [studentId]: note }));
    setStudents((currentStudents) =>
      currentStudents.map((student) => (student.id === studentId ? { ...student, note } : student))
    );

    const { data: sessionData } = await supabase.auth.getSession();
    await fetch("/api/admin/student-notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        studentId,
        note,
        departmentId: session?.role === "master" ? selectedFranchiseId : undefined,
      }),
    });
  };

  const handleStudentExcelUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    setSelectedUploadFile(file.name);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const data = event.target?.result;

      if (!data) {
        setDataMessage("엑셀 파일을 읽지 못했습니다.");
        return;
      }

      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(firstSheet, {
        defval: "",
      });

      const studentRows = rows
        .map((row) => ({
          name: pickExcelValue(row, ["성명", "학생", "학생명", "이름", "name"]),
          grade: normalizeExcelGrade(pickExcelValue(row, ["학년", "grade"])),
          parent_phone: pickExcelValue(row, [
            "부모HP(모)",
            "부모HP",
            "부모HP",
            "학부모 연락처",
            "학부모연락처",
            "연락처",
            "parent_phone",
          ]),
        }))
        .filter((row) => row.name && row.grade && row.parent_phone);

      await saveStudents(studentRows);
    };

    reader.onerror = () => {
      setDataMessage("엑셀 파일을 읽지 못했습니다.");
    };

    reader.readAsArrayBuffer(file);
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <Link
          href="/"
          className="fixed left-8 top-8 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:text-blue-600"
        >
          학생 화면
        </Link>

        <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">POINT SYSTEM</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">관리자</h1>
            <p className="mt-2 text-sm text-slate-500">관리자 아이디로 로그인하거나 가입하세요.</p>
          </div>

          <div className="mt-8 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              onClick={() => {
                setAuthMode("login");
                setMessage("");
              }}
              className={`rounded-xl py-3 text-sm font-bold transition ${
                authMode === "login" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setAuthMode("signup");
                setMessage("");
              }}
              className={`rounded-xl py-3 text-sm font-bold transition ${
                authMode === "signup" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              회원가입
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {message}
            </div>
          )}

          {authMode === "login" ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">아이디</span>
              <input
                type="text"
                required
                autoCapitalize="none"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="아이디"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">비밀번호</span>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="비밀번호"
              />
            </label>
            <button
              disabled={isLoggingIn}
              className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {isLoggingIn ? "확인 중" : "로그인"}
            </button>
          </form>
          ) : (
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">아이디</span>
              <input
                type="text"
                required
                autoCapitalize="none"
                value={signupId}
                onChange={(event) => setSignupId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="아이디"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">관리자 이름</span>
              <input
                type="text"
                required
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="관리자 이름"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">가맹점</span>
              <select
                value={signupDepartment}
                onChange={(event) => setSignupDepartment(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
              >
                {SIGNUP_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">비밀번호</span>
              <input
                type="password"
                required
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="6자 이상"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">비밀번호 확인</span>
              <input
                type="password"
                required
                value={signupConfirm}
                onChange={(event) => setSignupConfirm(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="비밀번호 확인"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">관리자 가입 PIN</span>
              <input
                type="password"
                required
                autoCapitalize="characters"
                value={signupPin}
                onChange={(event) =>
                  setSignupPin(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 12)
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="관리자 가입 PIN"
              />
            </label>
            <button
              disabled={isSigningUp}
              className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {isSigningUp ? "가입 중" : "회원가입"}
            </button>
          </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-slate-200 bg-white px-5 py-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-xs font-black text-blue-600">POINT SYSTEM</p>
              <h1 className="mt-2 text-2xl font-black">관리 콘솔</h1>
            </div>
            <Link href="/" className="text-sm font-bold text-slate-500 hover:text-blue-600">
              학생 화면
            </Link>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-black">{session.name}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {ROLE_LABELS[session.role]} · {scopeLabel}
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const isFranchiseChild = ["students", "teachers", "shop"].includes(item.id);
              const franchiseChildLabel =
                isFranchiseChild && selectedFranchiseId
                  ? `${item.label} (${departmentNameById.get(selectedFranchiseId) ?? "선택 가맹점"})`
                  : item.label;

              return (
              <button
                key={item.id}
	              onClick={async () => {
                  if (item.id !== "announcements") {
                    resetAnnouncementDraft();
                  }

                  setActiveView(item.id);

                  if (item.id === "departments") {
                    await loadFranchiseSummary({
                      departmentId:
                        selectedFranchiseId ||
                        (session.role === "master" ? undefined : session.departmentId),
                      teacherId: selectedFranchiseTeacherId || undefined,
                      studentQuery: submittedFranchiseStudentSearchText,
                    });
                  }

                  if (item.id === "teachers") {
                    await loadTeacherData();
                  }

                  if (item.id === "announcements") {
                    await loadAnnouncements();
                  }
                }}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-black transition ${
                  activeView === item.id
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                } ${isFranchiseChild ? "ml-4 w-[calc(100%-1rem)] border-l-4 border-blue-200 pl-3" : ""}`}
              >
                {isFranchiseChild ? franchiseChildLabel : item.label}
              </button>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </aside>

        <section className="px-6 py-8 lg:px-10">
	          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
	            <div>
	              <p className="text-sm font-black text-blue-600">{scopeLabel}</p>
	              <h2 className="mt-1 text-3xl font-black">
	                {activeView === "students" && "학생 관리"}
	                {activeView === "teachers" && "강사 관리"}
	                {activeView === "shop" && "상점 관리"}
	                {activeView === "departments" && "가맹점 관리"}
	                {activeView === "pins" && "PIN 관리"}
	                {activeView === "announcements" && "공지 관리"}
	              </h2>
	            </div>
            {isLoadingData && <p className="text-sm font-bold text-slate-500">불러오는 중</p>}
          </header>

          {dataMessage && (
            <div className="mt-6 rounded-2xl bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
              {dataMessage}
            </div>
          )}

	          {activeView === "students" ? (
		            <StudentManagementView
		              role={session.role}
		              students={displayedStudents}
		              selectedStudent={selectedStudent}
		              checkedStudentIds={checkedStudentIds}
		              studentSearchText={studentSearchText}
	              studentNotes={studentNotes}
	              pointAmount={pointAmount}
	              pointReason={pointReason}
	              batchPointMode={batchPointMode}
	              batchPointAmount={batchPointAmount}
	              batchPointReason={batchPointReason}
	              isAdjustingPoints={isAdjustingPoints}
	              selectedUploadFile={selectedUploadFile}
	              newStudentName={newStudentName}
	              newStudentGrade={newStudentGrade}
	              newStudentPhone={newStudentPhone}
		              isSavingStudent={isSavingStudent}
		              isStudentModalOpen={isStudentModalOpen}
		              isDeletingStudents={isDeletingStudents}
		              isDraggingStudentFile={isDraggingStudentFile}
		              onStudentCheck={handleStudentCheck}
		              onToggleAllStudents={handleToggleAllStudents}
		              onStudentSearchTextChange={setStudentSearchText}
		              onStudentSearch={handleStudentSearch}
	              onPointAmountChange={setPointAmount}
	              onPointReasonChange={setPointReason}
	              onAdjustPoints={handlePointAdjustment}
	              onDirectedPointAdjustment={handleDirectedPointAdjustment}
	              onStudentNoteChange={handleStudentNoteChange}
	              onBatchPointModeChange={setBatchPointMode}
	              onBatchPointAmountChange={setBatchPointAmount}
	              onBatchPointReasonChange={setBatchPointReason}
	              onBatchPointConfirm={handleBatchPointAdjustment}
	              onExcelUpload={handleStudentExcelUpload}
	              onNewStudentNameChange={setNewStudentName}
	              onNewStudentGradeChange={setNewStudentGrade}
		              onNewStudentPhoneChange={setNewStudentPhone}
		              onAddStudent={handleAddStudent}
		              onStudentModalOpenChange={setIsStudentModalOpen}
		              onDeleteCheckedStudents={handleDeleteCheckedStudents}
	              onDragStateChange={setIsDraggingStudentFile}
	            />
	          ) : activeView === "teachers" ? (
              <TeacherManagementView
                teacherTab={teacherTab}
                teachers={teacherSummaries}
                retiredTeachers={retiredTeacherSummaries}
                expandedTeacherId={expandedTeacherId}
                selectedRetiredTeacherId={selectedRetiredTeacherId}
                newTeacherLoginId={newTeacherLoginId}
                newTeacherPassword={newTeacherPassword}
                newTeacherName={newTeacherName}
                editingTeacher={editingTeacher}
                teacherEditLoginId={teacherEditLoginId}
                teacherEditPassword={teacherEditPassword}
                isLoadingTeachers={isLoadingTeachers}
                isSavingTeacher={isSavingTeacher}
                onTeacherTabChange={setTeacherTab}
                onExpandedTeacherChange={setExpandedTeacherId}
                onRetiredTeacherChange={setSelectedRetiredTeacherId}
                onNewTeacherLoginIdChange={setNewTeacherLoginId}
                onNewTeacherPasswordChange={setNewTeacherPassword}
                onNewTeacherNameChange={setNewTeacherName}
                onAddTeacher={handleAddTeacher}
                onTeacherEditOpen={openTeacherEditModal}
                onTeacherEditClose={closeTeacherEditModal}
                onTeacherEditLoginIdChange={setTeacherEditLoginId}
                onTeacherEditPasswordChange={setTeacherEditPassword}
                onTeacherUpdate={handleUpdateTeacher}
              />
	          ) : activeView === "shop" ? (
	            <ShopManagementView
	              products={scopedProducts}
	              departmentNameById={departmentNameById}
	              showDepartment={session.role === "master"}
                isProductModalOpen={isProductModalOpen}
                productModalMode={productModalMode}
                productEmoji={productEmoji}
                productImageUrl={productImageUrl}
                productName={productName}
                productPrice={productPrice}
                isSavingProduct={isSavingProduct}
                onCreateProduct={openCreateProductModal}
                onEditProduct={openEditProductModal}
                onCloseProductModal={closeProductModal}
                onProductEmojiChange={setProductEmoji}
                onProductImageChange={handleProductImageChange}
                onProductNameChange={setProductName}
                onProductPriceChange={setProductPrice}
                onSaveProduct={handleSaveProduct}
	            />
		          ) : activeView === "departments" ? (
	            <DepartmentManagementView
	              departments={departments}
                canMutateFranchises={canMutateFranchises}
                franchiseSummary={franchiseSummary}
                selectedFranchiseId={selectedFranchiseId}
                selectedFranchiseTeacherId={selectedFranchiseTeacherId}
                franchiseStudentSearchText={franchiseStudentSearchText}
                isLoadingFranchiseSummary={isLoadingFranchiseSummary}
                resetPassword={resetPassword}
                resetPasswordConfirm={resetPasswordConfirm}
                isResettingPassword={isResettingPassword}
                isCredentialModalOpen={isCredentialModalOpen}
                isEditingCredentials={isEditingCredentials}
                credentialLoginId={credentialLoginId}
                credentialPassword={credentialPassword}
                isSavingCredentials={isSavingCredentials}
	              newDepartmentName={newDepartmentName}
	              newDepartmentOwnerName={newDepartmentOwnerName}
	              newDepartmentManagerId={newDepartmentManagerId}
	              newDepartmentManagerPassword={newDepartmentManagerPassword}
                isDepartmentModalOpen={isDepartmentModalOpen}
		              isSavingDepartment={isSavingDepartment}
				              onNewDepartmentNameChange={setNewDepartmentName}
				              onNewDepartmentOwnerNameChange={setNewDepartmentOwnerName}
				              onNewDepartmentManagerIdChange={setNewDepartmentManagerId}
				              onNewDepartmentManagerPasswordChange={setNewDepartmentManagerPassword}
				              onAddDepartment={handleAddDepartment}
                onDepartmentModalOpenChange={setIsDepartmentModalOpen}
                onFranchiseChange={async (departmentId) => {
                  setSelectedFranchiseId(departmentId);
                  setSelectedFranchiseTeacherId("");
                  setResetPassword("");
                  setResetPasswordConfirm("");
                  setCheckedStudentIds(new Set());
                  setSubmittedStudentSearchText("");
                  setStudentSearchText("");
                  setTeacherSummaries([]);
                  setRetiredTeacherSummaries([]);
                  await loadFranchiseSummary({
                    departmentId,
                    studentQuery: submittedFranchiseStudentSearchText,
                  });
                }}
                onTeacherChange={async (teacherId) => {
                  setSelectedFranchiseTeacherId(teacherId);
                  setResetPassword("");
                  setResetPasswordConfirm("");
                  await loadFranchiseSummary({
                    departmentId: selectedFranchiseId,
                    teacherId,
                    studentQuery: submittedFranchiseStudentSearchText,
                  });
                }}
                onFranchiseStudentSearchTextChange={setFranchiseStudentSearchText}
                onFranchiseStudentSearch={async (event) => {
                  event.preventDefault();
                  setSubmittedFranchiseStudentSearchText(franchiseStudentSearchText);
                  await loadFranchiseSummary({
                    departmentId: selectedFranchiseId,
                    teacherId: selectedFranchiseTeacherId,
                    studentQuery: franchiseStudentSearchText,
                  });
                }}
                onResetPasswordChange={setResetPassword}
                onResetPasswordConfirmChange={setResetPasswordConfirm}
                onResetAdminPassword={handleResetAdminPassword}
                onCredentialModalOpen={handleOpenCredentialModal}
                onCredentialModalClose={handleCloseCredentialModal}
                onCredentialEditStart={() => setIsEditingCredentials(true)}
                onCredentialEditCancel={handleCancelCredentialEdit}
                onCredentialLoginIdChange={setCredentialLoginId}
                onCredentialPasswordChange={setCredentialPassword}
                onCredentialUpdate={handleUpdateCredentials}
              />
		          ) : activeView === "pins" ? (
		            <PinManagementView
		              departments={departments}
		              pinSettings={pinSettings}
		              savedPinDepartments={savedPinDepartments}
		              savingPinDepartmentId={savingPinDepartmentId}
		              copiedPinDepartment={copiedPinDepartment}
		              onPinChange={handlePinChange}
		              onGeneratePin={handleGeneratePin}
		              onSavePin={handleSavePin}
		              onCopyPin={handleCopyPin}
		              onDeleteDepartment={handleDeleteDepartment}
		              deletingDepartmentId={deletingDepartmentId}
		            />
		          ) : (
		            <AnnouncementManagementView
		              mode={announcementMode}
		              order={announcementOrder}
		              announcements={announcements}
		              content={announcementContent}
		              editingAnnouncementId={editingAnnouncementId}
		              editingContent={editingAnnouncementContent}
		              isSaving={isSavingAnnouncement}
		              isLoading={isLoadingAnnouncements}
		              deletingAnnouncementId={deletingAnnouncementId}
		              onModeChange={setAnnouncementMode}
		              onOrderChange={async (order) => {
		                setAnnouncementOrder(order);
		                await loadAnnouncements(order);
		              }}
		              onContentChange={setAnnouncementContent}
		              onCreate={handleCreateAnnouncement}
		              onEditStart={(announcement) => {
		                setEditingAnnouncementId(announcement.id);
		                setEditingAnnouncementContent(announcement.content);
		              }}
		              onEditingContentChange={setEditingAnnouncementContent}
		              onEditCancel={() => {
		                setEditingAnnouncementId(null);
		                setEditingAnnouncementContent("");
		              }}
		              onUpdate={handleUpdateAnnouncement}
		              onDelete={handleDeleteAnnouncement}
		            />
		          )}
        </section>
      </div>
    </main>
  );
}

function StudentManagementView({
  role,
  students,
  selectedStudent,
  checkedStudentIds,
  studentSearchText,
  studentNotes,
  pointAmount,
  pointReason,
  batchPointMode,
  batchPointAmount,
  batchPointReason,
  isAdjustingPoints,
  selectedUploadFile,
  newStudentName,
  newStudentGrade,
  newStudentPhone,
  isSavingStudent,
  isStudentModalOpen,
  isDeletingStudents,
  isDraggingStudentFile,
  onStudentCheck,
  onToggleAllStudents,
  onStudentSearchTextChange,
  onStudentSearch,
  onPointAmountChange,
  onPointReasonChange,
  onAdjustPoints,
  onDirectedPointAdjustment,
  onStudentNoteChange,
  onBatchPointModeChange,
  onBatchPointAmountChange,
  onBatchPointReasonChange,
  onBatchPointConfirm,
  onExcelUpload,
  onNewStudentNameChange,
  onNewStudentGradeChange,
  onNewStudentPhoneChange,
  onAddStudent,
  onStudentModalOpenChange,
  onDeleteCheckedStudents,
  onDragStateChange,
}: {
  role: AdminRole;
  students: Student[];
  selectedStudent: Student | null;
  checkedStudentIds: Set<string>;
  studentSearchText: string;
  studentNotes: Record<string, string>;
  pointAmount: string;
  pointReason: string;
  batchPointMode: "give" | "recover" | null;
  batchPointAmount: string;
  batchPointReason: string;
  isAdjustingPoints: boolean;
  selectedUploadFile: string;
  newStudentName: string;
  newStudentGrade: string;
  newStudentPhone: string;
  isSavingStudent: boolean;
  isStudentModalOpen: boolean;
  isDeletingStudents: boolean;
  isDraggingStudentFile: boolean;
  onStudentCheck: (studentId: string, checked: boolean) => void;
  onToggleAllStudents: (checked: boolean) => void;
  onStudentSearchTextChange: (text: string) => void;
  onStudentSearch: (event: FormEvent<HTMLFormElement>) => void;
  onPointAmountChange: (amount: string) => void;
  onPointReasonChange: (reason: string) => void;
  onAdjustPoints: () => void;
  onDirectedPointAdjustment: (student: Student, direction: "give" | "recover") => void;
  onStudentNoteChange: (studentId: string, note: string) => void;
  onBatchPointModeChange: (mode: "give" | "recover" | null) => void;
  onBatchPointAmountChange: (amount: string) => void;
  onBatchPointReasonChange: (reason: string) => void;
  onBatchPointConfirm: () => void;
  onExcelUpload: (file: File | null) => void;
  onNewStudentNameChange: (name: string) => void;
  onNewStudentGradeChange: (grade: string) => void;
  onNewStudentPhoneChange: (phone: string) => void;
  onAddStudent: (event: FormEvent<HTMLFormElement>) => void;
  onStudentModalOpenChange: (isOpen: boolean) => void;
  onDeleteCheckedStudents: () => void;
  onDragStateChange: (isDragging: boolean) => void;
}) {
  const isPointFocused = role === "staff";
  const canEditStudents = role !== "staff";
  const allStudentsChecked = students.length > 0 && checkedStudentIds.size === students.length;
  const checkedStudents = students.filter((student) => checkedStudentIds.has(student.id));
  const [expandedStudentId, setExpandedStudentId] = useState("");
  const [expandedNoteStudentId, setExpandedNoteStudentId] = useState("");

  if (isPointFocused) {
    return (
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-black text-slate-500">코인 지급</p>
            <form onSubmit={onStudentSearch} className="mt-3 flex gap-2">
              <input
                type="text"
                value={studentSearchText}
                onChange={(event) => onStudentSearchTextChange(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="학생 이름"
              />
              <button className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                확인
              </button>
            </form>
          </div>

          <div className="divide-y divide-slate-100">
            {students.map((student) => {
              const isExpanded = expandedStudentId === student.id;

              return (
                <div key={student.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedStudentId(isExpanded ? "" : student.id)}
                    className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[1.1fr_1.4fr_0.8fr_0.9fr_auto]"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-400">학생 이름</p>
                      <p className="mt-1 font-black">{student.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400">부모님 번호</p>
                      <p className="mt-1 font-bold text-slate-600">{student.parent_phone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400">학년</p>
                      <p className="mt-1 font-bold text-slate-600">
                        {getPromotedGrade(student.grade, student.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-400">보유 포인트</p>
                      <p className="mt-1 font-black text-blue-600">
                        {student.points.toLocaleString()} DP
                      </p>
                    </div>
                    <span className="self-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                      {isExpanded ? "닫기" : "열기"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="grid gap-4 bg-slate-50 px-5 py-5 lg:grid-cols-[1fr_auto]">
                      <div>
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={pointAmount}
                            onChange={(event) =>
                              onPointAmountChange(event.target.value.replace(/[^\d-]/g, ""))
                            }
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                            placeholder="포인트"
                          />
                          <input
                            type="text"
                            value={pointReason}
                            onChange={(event) => onPointReasonChange(event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                            placeholder="지급/회수 사유"
                          />
                        </div>
                        <textarea
                          value={studentNotes[student.id] ?? student.note ?? ""}
                          onChange={(event) => onStudentNoteChange(student.id, event.target.value)}
                          className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                          placeholder="비고"
                        />
                      </div>
                      <div className="flex flex-col gap-2 lg:w-36">
                        <button
                          disabled={isAdjustingPoints}
                          onClick={() => onDirectedPointAdjustment(student, "give")}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          포인트 추가
                        </button>
                        <button
                          disabled={isAdjustingPoints}
                          onClick={() => onDirectedPointAdjustment(student, "recover")}
                          className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 disabled:text-rose-300"
                        >
                          포인트 회수
                        </button>
                        <label className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-black text-slate-600">
                          <input
                            type="checkbox"
                            checked={checkedStudentIds.has(student.id)}
                            onChange={(event) => onStudentCheck(student.id, event.target.checked)}
                            className="h-4 w-4"
                          />
                          선택
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!students.length && (
              <p className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                검색된 학생이 없습니다.
              </p>
            )}
          </div>
        </section>

        <aside className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">선택한 학생</p>
          <div className="mt-4 space-y-2">
            {checkedStudents.map((student) => (
              <div key={student.id} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="font-black">{student.name}</p>
                <p className="mt-1 text-sm font-bold text-blue-600">
                  {student.points.toLocaleString()} DP
                </p>
              </div>
            ))}
            {!checkedStudents.length && (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                체크 박스로 학생을 추가하세요.
              </p>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              disabled={!checkedStudents.length}
              onClick={() => onBatchPointModeChange("give")}
              className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              일괄 지급            </button>
            <button
              disabled={!checkedStudents.length}
              onClick={() => onBatchPointModeChange("recover")}
              className="rounded-xl bg-rose-50 px-3 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 disabled:text-rose-300"
            >
              일괄 회수
            </button>
          </div>
          {batchPointMode && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-600">
                {batchPointMode === "give" ? "지급할 포인트 작성" : "회수할 포인트 작성"}
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={batchPointAmount}
                onChange={(event) => onBatchPointAmountChange(event.target.value.replace(/\D/g, ""))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-400"
              />
              <input
                type="text"
                value={batchPointReason}
                onChange={(event) => onBatchPointReasonChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-400"
                placeholder="일괄 지급/회수 사유"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  disabled={isAdjustingPoints}
                  onClick={onBatchPointConfirm}
                  className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  확인
                </button>
                <button
                  disabled={isAdjustingPoints}
                  onClick={() => {
                    onBatchPointModeChange(null);
                    onBatchPointAmountChange("");
                    onBatchPointReasonChange("");
                  }}
                  className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-600 hover:bg-slate-200"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
      <section
        onDragOver={(event) => {
          if (!canEditStudents) {
            return;
          }

          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onDragStateChange(false);
          }
        }}
        onDrop={(event) => {
          if (!canEditStudents) {
            return;
          }

          event.preventDefault();
          onDragStateChange(false);
          onExcelUpload(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`overflow-hidden rounded-2xl bg-white shadow-sm transition ${
          isDraggingStudentFile ? "ring-4 ring-blue-200" : ""
        }`}
      >
	        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
	          <div>
	            <p className="text-sm font-black text-slate-500">
	              {isPointFocused ? "포인트 조정 대상 검색" : "학생 검색"}
	            </p>
	            {selectedUploadFile && (
	              <p className="mt-1 text-xs font-bold text-slate-400">{selectedUploadFile}</p>
	            )}
	          </div>
	          <div className="flex flex-wrap gap-2">
              <form onSubmit={onStudentSearch} className="flex min-w-[280px] flex-1 gap-2">
                <input
                  type="text"
                  value={studentSearchText}
                  onChange={(event) => onStudentSearchTextChange(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="학생 이름 또는 학부모 연락처"
                />
                <button className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
                  검색
                </button>
              </form>
	            {canEditStudents && (
	              <>
                <button
                  onClick={() => onStudentModalOpenChange(true)}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  학생 추가
                </button>
	              <button
	                disabled={!checkedStudentIds.size || isDeletingStudents}
	                onClick={onDeleteCheckedStudents}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-red-50 hover:text-red-600 disabled:bg-slate-50 disabled:text-slate-300"
              >
                {isDeletingStudents ? "삭제 중" : "선택 삭제"}
              </button>
              <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                엑셀 업로드
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
	                  onChange={(event) => onExcelUpload(event.target.files?.[0] ?? null)}
	                />
	              </label>
	              </>
	            )}
	          </div>
	        </div>
        {canEditStudents && (
          <div
            className={`mx-5 mt-5 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${
              isDraggingStudentFile
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            <p className="text-sm font-black">엑셀 파일을 이 영역에 드래그해서 업로드</p>
            <p className="mt-1 text-xs font-bold">지원 컬럼: 학생/이름, 학년, 학부모 연락처</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {canEditStudents && (
                  <th className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allStudentsChecked}
                      onChange={(event) => onToggleAllStudents(event.target.checked)}
                      className="h-4 w-4"
                    />
                  </th>
                )}
                <th className="px-5 py-3">학생</th>
                <th className="px-5 py-3">학년</th>
                <th className="px-5 py-3">학부모 연락처</th>
                <th className="px-5 py-3">포인트</th>
                <th className="px-5 py-3">비고</th>
                <th className="px-5 py-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => {
                const isNoteExpanded = expandedNoteStudentId === student.id;

                return (
                  <>
                    <tr key={student.id} className="hover:bg-slate-50">
                      {canEditStudents && (
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={checkedStudentIds.has(student.id)}
                            onChange={(event) => onStudentCheck(student.id, event.target.checked)}
                            className="h-4 w-4"
                          />
                        </td>
                      )}
                      <td className="px-5 py-4 font-black">{student.name}</td>
                      <td className="px-5 py-4 text-slate-500">
                        {getPromotedGrade(student.grade, student.created_at)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{student.parent_phone}</td>
                      <td className="px-5 py-4 font-black text-blue-600">
                        {student.points.toLocaleString()} DP
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedNoteStudentId(isNoteExpanded ? "" : student.id)}
                          className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                        >
                          {isNoteExpanded ? "비고 닫기" : "비고 확인"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          {student.is_active ? "활성" : "비활성"}
                        </span>
                      </td>
                    </tr>
                    {isNoteExpanded && (
                      <tr key={`${student.id}-note`} className="bg-slate-50">
                        <td colSpan={canEditStudents ? 7 : 6} className="px-5 py-4">
                          <textarea
                            value={studentNotes[student.id] ?? student.note ?? ""}
                            onChange={(event) => onStudentNoteChange(student.id, event.target.value)}
                            className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"
                            placeholder="비고"
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!students.length && (
                <tr>
                  <td
                    colSpan={canEditStudents ? 7 : 6}
                    className="px-5 py-12 text-center font-bold text-slate-400"
                  >
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
	      </section>

	      <aside className="rounded-2xl bg-white p-5 shadow-sm">
	        <p className="text-sm font-black text-slate-500">포인트 관리</p>
	        <h3 className="mt-2 text-xl font-black">
	          {selectedStudent ? selectedStudent.name : "학생을 선택하세요"}
	        </h3>
	        <p className="mt-1 text-sm font-bold text-slate-500">
	          현재 포인트 {selectedStudent ? selectedStudent.points.toLocaleString() : 0} DP
	        </p>
	        {selectedStudent && (
	          <p className="mt-1 text-xs font-bold text-slate-400">
	            {getPromotedGrade(selectedStudent.grade, selectedStudent.created_at)} ·{" "}
	            {selectedStudent.parent_phone}
	          </p>
	        )}
	        {checkedStudentIds.size > 1 && (
	          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
	            포인트 조정은 한 번에 학생 1명만 가능합니다.
	          </p>
	        )}

        <div className="mt-6 space-y-4">
	          <label className="block">
	            <span className="text-sm font-bold text-slate-600">조정 포인트</span>
	            <input
	              type="text"
	              inputMode="numeric"
	              value={pointAmount}
	              onChange={(event) => onPointAmountChange(event.target.value)}
	              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="포인트 차감은 -를 붙이세요"
	            />
	          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-600">사유</span>
            <input
              type="text"
              value={pointReason}
              onChange={(event) => onPointReasonChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>
	          <div>
	            <button
	              disabled={!selectedStudent || checkedStudentIds.size !== 1 || isAdjustingPoints}
	              onClick={onAdjustPoints}
	              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
	            >
	              포인트 조정
	            </button>
	          </div>
	        </div>
	      </aside>
        {isStudentModalOpen && canEditStudents && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
            <form onSubmit={onAddStudent} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-blue-600">학생 추가</p>
                  <h3 className="mt-1 text-2xl font-black">개별 추가</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onStudentModalOpenChange(false)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
                >
                  닫기
                </button>
              </div>
              <div className="mt-6 space-y-4">
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(event) => onNewStudentNameChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="학생 이름"
                />
                <select
                  required
                  value={newStudentGrade}
                  onChange={(event) => onNewStudentGradeChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                >
                  <option value="">학년 선택</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  required
                  value={newStudentPhone}
                  onChange={(event) => onNewStudentPhoneChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="학부모 연락처"
                />
                <button
                  disabled={isSavingStudent}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {isSavingStudent ? "추가 중" : "학생 추가"}
                </button>
              </div>
            </form>
          </div>
        )}
	    </div>
	  );
}

function TeacherManagementView({
  teacherTab,
  teachers,
  retiredTeachers,
  expandedTeacherId,
  selectedRetiredTeacherId,
  newTeacherLoginId,
  newTeacherPassword,
  newTeacherName,
  editingTeacher,
  teacherEditLoginId,
  teacherEditPassword,
  isLoadingTeachers,
  isSavingTeacher,
  onTeacherTabChange,
  onExpandedTeacherChange,
  onRetiredTeacherChange,
  onNewTeacherLoginIdChange,
  onNewTeacherPasswordChange,
  onNewTeacherNameChange,
  onAddTeacher,
  onTeacherEditOpen,
  onTeacherEditClose,
  onTeacherEditLoginIdChange,
  onTeacherEditPasswordChange,
  onTeacherUpdate,
}: {
  teacherTab: "manage" | "create" | "retired";
  teachers: TeacherSummary[];
  retiredTeachers: RetiredTeacherSummary[];
  expandedTeacherId: string;
  selectedRetiredTeacherId: string;
  newTeacherLoginId: string;
  newTeacherPassword: string;
  newTeacherName: string;
  editingTeacher: TeacherSummary | null;
  teacherEditLoginId: string;
  teacherEditPassword: string;
  isLoadingTeachers: boolean;
  isSavingTeacher: boolean;
  onTeacherTabChange: (tab: "manage" | "create" | "retired") => void;
  onExpandedTeacherChange: (teacherId: string) => void;
  onRetiredTeacherChange: (teacherId: string) => void;
  onNewTeacherLoginIdChange: (id: string) => void;
  onNewTeacherPasswordChange: (password: string) => void;
  onNewTeacherNameChange: (name: string) => void;
  onAddTeacher: (event: FormEvent<HTMLFormElement>) => void;
  onTeacherEditOpen: (teacher: TeacherSummary) => void;
  onTeacherEditClose: () => void;
  onTeacherEditLoginIdChange: (id: string) => void;
  onTeacherEditPasswordChange: (password: string) => void;
  onTeacherUpdate: (retire?: boolean) => void;
}) {
  const expandedTeacher = teachers.find((teacher) => teacher.id === expandedTeacherId) ?? teachers[0] ?? null;
  const selectedRetiredTeacher =
    retiredTeachers.find((teacher) => teacher.id === selectedRetiredTeacherId) ??
    retiredTeachers[0] ??
    null;

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "manage" as const, label: "강사 관리" },
          { id: "create" as const, label: "강사 추가" },
          { id: "retired" as const, label: "퇴직 강사 관리" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTeacherTabChange(tab.id)}
            className={`rounded-xl px-4 py-3 text-sm font-black ${
              teacherTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoadingTeachers && (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-500">
          강사 정보를 불러오는 중        </p>
      )}

      {teacherTab === "manage" && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">강사 이름 / 강사 비밀번호</th>
                  <th className="px-5 py-3">이번 달 코인 지급 현황</th>
                  <th className="px-5 py-3">이번 달 코인 회수 현황</th>
                  <th className="px-5 py-3">코인 지급 및 회수 리스트</th>
                  <th className="px-5 py-3">정보 수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{teacher.passwordLabel}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-600">
                          {FRANCHISE_MEMBER_ROLE_LABELS[teacher.role] ?? teacher.role}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-400">PW는 재설정만 가능</p>
                    </td>
                    <td className="px-5 py-4 font-black text-blue-600">
                      {teacher.givenThisMonth.toLocaleString()} DP
                    </td>
                    <td className="px-5 py-4 font-black text-rose-600">
                      {teacher.recoveredThisMonth.toLocaleString()} DP
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => onExpandedTeacherChange(teacher.id)}
                        className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                      >
                        리스트 보기
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {teacher.role === "staff" ? (
                        <button
                          onClick={() => onTeacherEditOpen(teacher)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                        >
                          정보 수정
                        </button>
                      ) : (
                        <span className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-500">
                          상세 확인에서 수정
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!teachers.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center font-bold text-slate-400">
                      등록된 강사가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {expandedTeacher && (
            <div className="border-t border-slate-100 px-5 py-5">
              <p className="text-sm font-black text-slate-500">
                {expandedTeacher.passwordLabel} 코인 지급/회수 리스트              </p>
              <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-2">
                {expandedTeacher.transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl bg-slate-50 p-4">
                    <p className="font-black">{transaction.studentName}</p>
                    <p className={`mt-1 font-black ${transaction.amount >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {transaction.amount.toLocaleString()} DP
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">{transaction.reason}</p>
                    <input
                      readOnly
                      value={transaction.note}
                      placeholder="작성된 학생 비고 없음"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 outline-none"
                    />
                  </div>
                ))}
                {!expandedTeacher.transactions.length && (
                  <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    이번 달 지급/회수 내역이 없습니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {teacherTab === "create" && (
        <form onSubmit={onAddTeacher} className="max-w-xl rounded-2xl bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">ID</span>
              <input
                type="text"
                required
                value={newTeacherLoginId}
                onChange={(event) => onNewTeacherLoginIdChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="예: Seed"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">PW</span>
              <input
                type="text"
                required
                value={newTeacherPassword}
                onChange={(event) => onNewTeacherPasswordChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">본명</span>
              <input
                type="text"
                required
                value={newTeacherName}
                onChange={(event) => onNewTeacherNameChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="예: 차윤빈"
              />
            </label>
          </div>
          <button
            disabled={isSavingTeacher}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isSavingTeacher ? "추가 중" : "확인"}
          </button>
        </form>
      )}

      {teacherTab === "retired" && (
        <section className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm lg:grid-cols-[260px_1fr]">
          <aside>
            <select
              value={selectedRetiredTeacherId}
              onChange={(event) => onRetiredTeacherChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"
            >
              {retiredTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.loginId}({teacher.name}) - {FRANCHISE_MEMBER_ROLE_LABELS[teacher.role] ?? teacher.role}
                </option>
              ))}
            </select>
          </aside>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">학생 이름</th>
                  <th className="px-5 py-3">부모님 번호</th>
                  <th className="px-5 py-3">학년</th>
                  <th className="px-5 py-3">지급 및 회수 포인트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedRetiredTeacher?.students ?? []).map((student) => (
                  <tr key={`${student.studentName}-${student.parentPhone}`}>
                    <td className="px-5 py-4 font-black">{student.studentName}</td>
                    <td className="px-5 py-4 text-slate-500">{student.parentPhone}</td>
                    <td className="px-5 py-4 text-slate-500">{student.grade}</td>
                    <td className="px-5 py-4 font-black text-blue-600">
                      {student.points.toLocaleString()} DP
                    </td>
                  </tr>
                ))}
                {!selectedRetiredTeacher?.students.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center font-bold text-slate-400">
                      아직 지급/회수 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm font-black text-blue-600">강사 정보 수정</p>
            <h3 className="mt-1 text-2xl font-black">{editingTeacher.passwordLabel}</h3>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-600">강사 아이디</span>
                <input
                  type="text"
                  value={teacherEditLoginId}
                  onChange={(event) => onTeacherEditLoginIdChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">강사 비밀번호</span>
                <input
                  type="text"
                  value={teacherEditPassword}
                  onChange={(event) => onTeacherEditPasswordChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={isSavingTeacher}
              onClick={() => onTeacherUpdate(true)}
              className="mt-4 w-full rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-100 disabled:text-rose-300"
            >
              강사 등록 해제
            </button>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSavingTeacher}
                onClick={() => onTeacherUpdate(false)}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                확인
              </button>
              <button
                type="button"
                disabled={isSavingTeacher}
                onClick={onTeacherEditClose}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200 disabled:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopManagementView({
  products,
  departmentNameById,
  showDepartment,
  isProductModalOpen,
  productModalMode,
  productEmoji,
  productImageUrl,
  productName,
  productPrice,
  isSavingProduct,
  onCreateProduct,
  onEditProduct,
  onCloseProductModal,
  onProductEmojiChange,
  onProductImageChange,
  onProductNameChange,
  onProductPriceChange,
  onSaveProduct,
}: {
  products: Product[];
  departmentNameById: Map<string, string>;
  showDepartment: boolean;
  isProductModalOpen: boolean;
  productModalMode: "create" | "edit";
  productEmoji: string;
  productImageUrl: string;
  productName: string;
  productPrice: string;
  isSavingProduct: boolean;
  onCreateProduct: () => void;
  onEditProduct: (product: Product) => void;
  onCloseProductModal: () => void;
  onProductEmojiChange: (emoji: string) => void;
  onProductImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onProductNameChange: (name: string) => void;
  onProductPriceChange: (price: string) => void;
  onSaveProduct: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-8 space-y-4">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-black text-slate-500">상품 리스트</p>
          <button
            onClick={onCreateProduct}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            상품 추가
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">상품 아이콘</th>
                <th className="px-5 py-3">상품 이름</th>
                {showDepartment && <th className="px-5 py-3">가맹점</th>}
                <th className="px-5 py-3">상품 가격</th>
                <th className="px-5 py-3">상품 수정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xl font-black">
                      {product.image_url ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${product.image_url})` }}
                        />
                      ) : (
                        product.emoji ?? "상품"
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-black">{product.name}</td>
                  {showDepartment && (
                    <td className="px-5 py-4 text-slate-500">
                      {departmentNameById.get(product.department_id) ?? "미지정"}
                    </td>
                  )}
                  <td className="px-5 py-4 font-black text-blue-600">
                    {product.price_dp.toLocaleString()} DP
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onEditProduct(product)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                    >
                      상품 수정
                    </button>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td
                    colSpan={showDepartment ? 5 : 4}
                    className="px-5 py-12 text-center font-bold text-slate-400"
                  >
                    아직 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <form onSubmit={onSaveProduct} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div>
              <p className="text-sm font-black text-blue-600">
                {productModalMode === "create" ? "상품 추가" : "상품 수정"}
              </p>
              <h3 className="mt-1 text-2xl font-black">
                {productModalMode === "create" ? "새 상품" : productName || "상품"}
              </h3>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-600">
                  {productModalMode === "create" ? "추가할 상품 아이콘" : "상품 아이콘"}
                </span>
                <input
                  type="text"
                  value={productEmoji}
                  onChange={(event) => onProductEmojiChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="예: 사탕"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">
                  {productModalMode === "create"
                    ? "추가할 상품 선물 이미지"
                    : "상품 선물 이미지"}
                </span>
                <label className="mt-2 flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-black text-slate-500 hover:bg-slate-100">
                  {productImageUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${productImageUrl})` }}
                    />
                  ) : (
                    "이미지 업로드"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onProductImageChange}
                  />
                </label>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">상품 이름</span>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(event) => onProductNameChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">상품 가격</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={productPrice}
                  onChange={(event) => onProductPriceChange(event.target.value.replace(/\D/g, ""))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                />
              </label>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                disabled={isSavingProduct}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {productModalMode === "create"
                  ? isSavingProduct
                    ? "추가 중"
                    : "추가 확인"
                  : isSavingProduct
                    ? "수정 중"
                    : "확인"}
              </button>
              <button
                type="button"
                disabled={isSavingProduct}
                onClick={onCloseProductModal}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200 disabled:bg-slate-50"
              >
                {productModalMode === "create" ? "추가 취소" : "취소"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function DepartmentManagementView({
  departments,
  canMutateFranchises,
  franchiseSummary,
  selectedFranchiseId,
  selectedFranchiseTeacherId,
  franchiseStudentSearchText,
  isLoadingFranchiseSummary,
  resetPassword,
  resetPasswordConfirm,
  isResettingPassword,
  isCredentialModalOpen,
  isEditingCredentials,
  credentialLoginId,
  credentialPassword,
  isSavingCredentials,
  newDepartmentName,
  newDepartmentOwnerName,
  newDepartmentManagerId,
  newDepartmentManagerPassword,
  isDepartmentModalOpen,
  isSavingDepartment,
  onNewDepartmentNameChange,
  onNewDepartmentOwnerNameChange,
  onNewDepartmentManagerIdChange,
  onNewDepartmentManagerPasswordChange,
  onAddDepartment,
  onDepartmentModalOpenChange,
  onFranchiseChange,
  onTeacherChange,
  onFranchiseStudentSearchTextChange,
  onFranchiseStudentSearch,
  onResetPasswordChange,
  onResetPasswordConfirmChange,
  onResetAdminPassword,
  onCredentialModalOpen,
  onCredentialModalClose,
  onCredentialEditStart,
  onCredentialEditCancel,
  onCredentialLoginIdChange,
  onCredentialPasswordChange,
  onCredentialUpdate,
}: {
  departments: Department[];
  canMutateFranchises: boolean;
  franchiseSummary: FranchiseSummary | null;
  selectedFranchiseId: string;
  selectedFranchiseTeacherId: string;
  franchiseStudentSearchText: string;
  isLoadingFranchiseSummary: boolean;
  resetPassword: string;
  resetPasswordConfirm: string;
  isResettingPassword: boolean;
  isCredentialModalOpen: boolean;
  isEditingCredentials: boolean;
  credentialLoginId: string;
  credentialPassword: string;
  isSavingCredentials: boolean;
  newDepartmentName: string;
  newDepartmentOwnerName: string;
  newDepartmentManagerId: string;
  newDepartmentManagerPassword: string;
  isDepartmentModalOpen: boolean;
  isSavingDepartment: boolean;
  onNewDepartmentNameChange: (name: string) => void;
  onNewDepartmentOwnerNameChange: (name: string) => void;
  onNewDepartmentManagerIdChange: (id: string) => void;
  onNewDepartmentManagerPasswordChange: (password: string) => void;
  onAddDepartment: (event: FormEvent<HTMLFormElement>) => void;
  onDepartmentModalOpenChange: (isOpen: boolean) => void;
  onFranchiseChange: (departmentId: string) => void;
  onTeacherChange: (teacherId: string) => void;
  onFranchiseStudentSearchTextChange: (text: string) => void;
  onFranchiseStudentSearch: (event: FormEvent<HTMLFormElement>) => void;
  onResetPasswordChange: (password: string) => void;
  onResetPasswordConfirmChange: (password: string) => void;
  onResetAdminPassword: (event: FormEvent<HTMLFormElement>) => void;
  onCredentialModalOpen: () => void;
  onCredentialModalClose: () => void;
  onCredentialEditStart: () => void;
  onCredentialEditCancel: () => void;
  onCredentialLoginIdChange: (id: string) => void;
  onCredentialPasswordChange: (password: string) => void;
  onCredentialUpdate: () => void;
}) {
  const selectedDepartment = franchiseSummary?.selectedDepartment ?? null;
  const credentialTarget =
    franchiseSummary?.accounts.find((account) => account.role === "manager") ??
    franchiseSummary?.accounts[0] ??
    null;

  return (
    <div className="mt-8 space-y-6">
	      <section className="rounded-2xl bg-white p-5 shadow-sm">
	        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
	          <div>
            <p className="text-sm font-black text-slate-500">관리 가능한 가맹점</p>
            <h3 className="mt-2 text-2xl font-black">
              {selectedDepartment ? selectedDepartment.name : "가맹점을 선택하세요"}
            </h3>
            {isLoadingFranchiseSummary && (
              <p className="mt-1 text-sm font-bold text-slate-400">집계 불러오는 중</p>
            )}
	          </div>
	          <div className="flex flex-col gap-2 sm:flex-row">
	            <select
	              value={selectedFranchiseId}
	              onChange={(event) => onFranchiseChange(event.target.value)}
	              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white lg:w-72"
	            >
                {!selectedFranchiseId && <option value="">가맹점 선택</option>}
	              {departments.map((department) => (
	                <option key={department.id} value={department.id}>
	                  {department.name}
	                </option>
	              ))}
	            </select>
	            {canMutateFranchises && (
                <>
	              <button
	                onClick={() => onDepartmentModalOpenChange(true)}
	                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
	              >
	                가맹점 추가
	              </button>
	              <button
	                onClick={onCredentialModalOpen}
	                disabled={!credentialTarget}
	                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
	              >
	                상세 확인
	              </button>
                </>
	            )}
	          </div>
	        </div>
	      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">학생 보유 포인트 합계</p>
          <p className="mt-3 text-3xl font-black text-blue-600">
            {(franchiseSummary?.totalStudentPoints ?? 0).toLocaleString()} DP
          </p>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">상품 구매 사진 확인</p>
          <p className="mt-3 text-3xl font-black text-slate-900">
            {(franchiseSummary?.spentPurchasePoints ?? 0).toLocaleString()} DP
          </p>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">해당 가맹점의 강사</p>
          <div className="mt-4 space-y-2">
            {(franchiseSummary?.teachers ?? []).map((teacher) => (
              <button
                key={teacher.id}
                onClick={() => onTeacherChange(teacher.id)}
                className={`w-full rounded-xl px-4 py-3 text-left transition ${
                  selectedFranchiseTeacherId === teacher.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  {teacher.name}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-black ring-1 ring-current/20">
                    {FRANCHISE_MEMBER_ROLE_LABELS[teacher.role] ?? teacher.role}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-bold opacity-80">
                  지급 {teacher.totalAwardedPoints.toLocaleString()} DP
                </span>
              </button>
            ))}
            {!franchiseSummary?.teachers.length && (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                아직 강사가 없습니다.
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-black text-slate-500">
              {franchiseSummary?.selectedTeacher
                ? `${franchiseSummary.selectedTeacher.name} 지급 내역`
                : "강사 지급 내역"}
            </p>
            <p className="mt-1 text-xl font-black">
              {(franchiseSummary?.selectedTeacher?.totalAwardedPoints ?? 0).toLocaleString()} DP
            </p>
          </div>
          {canMutateFranchises && franchiseSummary?.selectedTeacher && (
            <form
              onSubmit={onResetAdminPassword}
              className="grid gap-3 border-b border-slate-100 px-5 py-4 lg:grid-cols-[1fr_1fr_auto]"
            >
              <label className="block">
                <span className="text-xs font-black text-slate-500">새 비밀번호</span>
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(event) => onResetPasswordChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="4자리 이상"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500">비밀번호 확인</span>
                <input
                  type="text"
                  value={resetPasswordConfirm}
                  onChange={(event) => onResetPasswordConfirmChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="다시 입력"
                />
              </label>
              <button
                type="submit"
                disabled={isResettingPassword}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 lg:mt-6"
              >
                {isResettingPassword ? "변경 중" : "비밀번호 변경"}
              </button>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">학생 이름</th>
                  <th className="px-5 py-3">사유</th>
                  <th className="px-5 py-3">지급 포인트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(franchiseSummary?.teacherTransactions ?? []).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-5 py-4 font-black">{transaction.studentName}</td>
                    <td className="px-5 py-4 text-slate-500">{transaction.reason}</td>
                    <td className="px-5 py-4 font-black text-blue-600">
                      {transaction.amount.toLocaleString()} DP
                    </td>
                  </tr>
                ))}
                {!franchiseSummary?.teacherTransactions.length && (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center font-bold text-slate-400">
                      지급 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-black text-slate-500">지점 가입 학생</p>
          <form onSubmit={onFranchiseStudentSearch} className="flex gap-2">
            <input
              type="text"
              value={franchiseStudentSearchText}
              onChange={(event) => onFranchiseStudentSearchTextChange(event.target.value)}
              className="w-64 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
              placeholder="학생 이름 또는 연락처"
            />
            <button className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700">
              확인
            </button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">가맹점</th>
                <th className="px-5 py-3">학생 이름</th>
                <th className="px-5 py-3">학생 보유 포인트</th>
                <th className="px-5 py-3">담당 강사</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(franchiseSummary?.students ?? []).map((student) => (
                <tr key={student.id}>
                  <td className="px-5 py-4 text-slate-500">{student.departmentName}</td>
                  <td className="px-5 py-4 font-black">{student.name}</td>
                  <td className="px-5 py-4 font-black text-blue-600">
                    {student.points.toLocaleString()} DP
                  </td>
                  <td className="px-5 py-4 text-slate-500">{student.teacherName}</td>
                </tr>
              ))}
              {!franchiseSummary?.students.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center font-bold text-slate-400">
                    아직 학생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCredentialModalOpen && canMutateFranchises && credentialTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-blue-600">manager 계정</p>
                <h3 className="mt-1 text-2xl font-black">{credentialTarget.name}</h3>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-600">ID</span>
                <input
                  type="text"
                  readOnly={!isEditingCredentials}
                  value={credentialLoginId}
                  onChange={(event) => onCredentialLoginIdChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white read-only:text-slate-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">PW</span>
                <input
                  type="text"
                  readOnly={!isEditingCredentials}
                  value={isEditingCredentials ? credentialPassword : "저장된 비밀번호는 확인할 수 없습니다"}
                  onChange={(event) => onCredentialPasswordChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white read-only:text-slate-500"
                />
              </label>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSavingCredentials}
                onClick={isEditingCredentials ? onCredentialUpdate : onCredentialEditStart}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isEditingCredentials ? (isSavingCredentials ? "저장 중" : "확인") : "수정"}
              </button>
              <button
                type="button"
                disabled={isSavingCredentials}
                onClick={isEditingCredentials ? onCredentialEditCancel : onCredentialModalClose}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-200 disabled:bg-slate-50"
              >
                {isEditingCredentials ? "취소" : "닫기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDepartmentModalOpen && canMutateFranchises && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <form onSubmit={onAddDepartment} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-blue-600">가맹점 관리</p>
                <h3 className="mt-1 text-2xl font-black">가맹점 추가</h3>
              </div>
              <button
                type="button"
                onClick={() => onDepartmentModalOpenChange(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
              >
                닫기
              </button>
            </div>
            <label className="mt-6 block">
              <span className="text-sm font-bold text-slate-600">가맹점명</span>
              <input
                type="text"
                required
                maxLength={50}
                value={newDepartmentName}
                onChange={(event) => onNewDepartmentNameChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="예: 서초"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-600">가맹점 주인 이름</span>
              <input
                type="text"
                required
                maxLength={50}
                value={newDepartmentOwnerName}
                onChange={(event) => onNewDepartmentOwnerNameChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="관리자 이름"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-600">manager ID</span>
              <input
                type="text"
                required
                autoCapitalize="none"
                maxLength={50}
                value={newDepartmentManagerId}
                onChange={(event) => onNewDepartmentManagerIdChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="로그인 ID"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-slate-600">manager PW</span>
              <input
                type="text"
                required
                minLength={6}
                value={newDepartmentManagerPassword}
                onChange={(event) => onNewDepartmentManagerPasswordChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                placeholder="6자 이상"
              />
            </label>
            <button
              disabled={isSavingDepartment}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {isSavingDepartment ? "저장 중" : "추가"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PinManagementView({
  departments,
  pinSettings,
  savedPinDepartments,
  savingPinDepartmentId,
  copiedPinDepartment,
  deletingDepartmentId,
  onPinChange,
  onGeneratePin,
  onSavePin,
  onCopyPin,
  onDeleteDepartment,
}: {
  departments: Department[];
  pinSettings: Record<string, string>;
  savedPinDepartments: Set<string>;
  savingPinDepartmentId: string | null;
  copiedPinDepartment: string | null;
  deletingDepartmentId: string | null;
  onPinChange: (departmentName: string, nextPin: string) => void;
  onGeneratePin: (departmentName: string) => void;
  onSavePin: (departmentName: string) => void;
  onCopyPin: (departmentName: string) => void;
  onDeleteDepartment: (departmentId: string) => void;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-black text-slate-500">가맹점 목록 및 가입 PIN</p>
      </div>
      <div className="divide-y divide-slate-100">
        {departments.map((department) => (
          <div
            key={department.id}
            className="grid gap-4 px-5 py-5 xl:grid-cols-[160px_1fr_auto_auto_auto_auto]"
          >
            <div>
              <p className="text-base font-black">{department.name}</p>
            </div>
            <input
              type="text"
              autoCapitalize="characters"
              value={pinSettings[department.name] ?? ""}
              onChange={(event) => onPinChange(department.name, event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-black tracking-widest outline-none focus:border-blue-400 focus:bg-white"
              placeholder="가입 PIN 없음"
            />
            <button
              disabled={!pinSettings[department.name]}
              onClick={() => onCopyPin(department.name)}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
            >
              {copiedPinDepartment === department.name ? "복사됨" : "복사"}
            </button>
            <button
              onClick={() => onGeneratePin(department.name)}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
            >
              {savedPinDepartments.has(department.name) ? "PIN 설정" : "PIN 생성"}
            </button>
            <button
              disabled={savingPinDepartmentId === department.name}
              onClick={() => onSavePin(department.name)}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {savingPinDepartmentId === department.name ? "저장 중" : "PIN 저장"}
            </button>
            <button
              disabled={deletingDepartmentId === department.id}
              onClick={() => onDeleteDepartment(department.id)}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-red-50 hover:text-red-600 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {deletingDepartmentId === department.id ? "삭제 중" : "삭제"}
            </button>
          </div>
        ))}
        {!departments.length && (
          <div className="px-5 py-12 text-center font-bold text-slate-400">
            아직 가맹점이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function AnnouncementManagementView({
  mode,
  order,
  announcements,
  content,
  editingAnnouncementId,
  editingContent,
  isSaving,
  isLoading,
  deletingAnnouncementId,
  onModeChange,
  onOrderChange,
  onContentChange,
  onCreate,
  onEditStart,
  onEditingContentChange,
  onEditCancel,
  onUpdate,
  onDelete,
}: {
  mode: "create" | "edit";
  order: "latest" | "oldest";
  announcements: Announcement[];
  content: string;
  editingAnnouncementId: string | null;
  editingContent: string;
  isSaving: boolean;
  isLoading: boolean;
  deletingAnnouncementId: string | null;
  onModeChange: (mode: "create" | "edit") => void;
  onOrderChange: (order: "latest" | "oldest") => void;
  onContentChange: (content: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEditStart: (announcement: Announcement) => void;
  onEditingContentChange: (content: string) => void;
  onEditCancel: () => void;
  onUpdate: (announcementId: string) => void;
  onDelete: (announcementId: string) => void;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-500">공지 관리</p>
            <p className="mt-1 text-xs font-bold text-slate-400">{formatKoreaDate(new Date())}</p>
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => onModeChange("create")}
              className={`rounded-lg px-4 py-2 text-sm font-black ${
                mode === "create" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              공지 작성
            </button>
            <button
              onClick={() => onModeChange("edit")}
              className={`rounded-lg px-4 py-2 text-sm font-black ${
                mode === "edit" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              공지 수정
            </button>
          </div>
        </div>
      </div>

      {mode === "create" ? (
        <form onSubmit={onCreate} className="p-5">
          <label className="block">
            <span className="text-sm font-bold text-slate-600">공지 내용</span>
            <textarea
              required
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              className="mt-2 min-h-52 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
              placeholder="공지 내용을 입력하세요"
            />
          </label>
          <button
            disabled={isSaving}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isSaving ? "등록 중" : "확인"}
          </button>
        </form>
      ) : (
        <div>
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-slate-500">
              {isLoading ? "공지 불러오는 중" : "작성된 공지"}
            </p>
            <select
              value={order}
              onChange={(event) => onOrderChange(event.target.value as "latest" | "oldest")}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white"
            >
              <option value="latest">최신 날짜순</option>
              <option value="oldest">오래된 날짜순</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">날짜</th>
                  <th className="px-5 py-3">공지 내용</th>
                  <th className="px-5 py-3">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announcements.map((announcement) => {
                  const isEditing = editingAnnouncementId === announcement.id;

                  return (
                    <tr key={announcement.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-bold text-slate-500">
                        {formatKoreaDate(announcement.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <textarea
                            value={editingContent}
                            onChange={(event) => onEditingContentChange(event.target.value)}
                            className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-400 focus:bg-white"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap font-bold text-slate-700">
                            {announcement.content}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              disabled={isSaving}
                              onClick={() => onUpdate(announcement.id)}
                              className="rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
                            >
                              완료
                            </button>
                            <button
                              onClick={onEditCancel}
                              className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-200"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => onEditStart(announcement)}
                              className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-200"
                            >
                              수정
                            </button>
                            <button
                              disabled={deletingAnnouncementId === announcement.id}
                              onClick={() => onDelete(announcement.id)}
                              className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700 hover:bg-red-50 hover:text-red-600 disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              {deletingAnnouncementId === announcement.id ? "삭제 중" : "삭제"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!announcements.length && (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center font-bold text-slate-400">
                      작성된 공지가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
