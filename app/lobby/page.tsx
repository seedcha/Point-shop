"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LoginStudent = {
  id: string;
  name: string;
  parent_phone: string;
  grade: string;
  points: number;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type RankingRow = {
  id: string;
  name: string;
  grade: string;
  points: number;
};

type LobbyAnnouncement = {
  id: string;
  type: "contest" | "vacation" | "award";
  title: string;
  startDate: string;
  endDate: string;
  details: string;
  awardStudents: Array<{
    id: string;
    studentName: string;
    awardName: string;
  }>;
};

type LobbyRankings = {
  departments: DepartmentOption[];
  selectedDepartmentId: string | null;
  rankings: {
    honor: RankingRow[];
    assets: RankingRow[];
  };
};

const rankingPanelMeta = [
  {
    id: "honor",
    title: "명예의 전당 누적 포인트",
    borderClass: "border-blue-500",
    highlightClass: "bg-blue-50 text-blue-700",
  },
  {
    id: "assets",
    title: "현재 보유 자산 랭킹",
    borderClass: "border-emerald-500",
    highlightClass: "bg-emerald-50 text-emerald-700",
  },
] as const;

const announcementTypeLabels: Record<LobbyAnnouncement["type"], string> = {
  contest: "대회",
  vacation: "방학",
  award: "수상",
};

export default function LobbyPage() {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentChoices, setStudentChoices] = useState<LoginStudent[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [rankingRows, setRankingRows] = useState<LobbyRankings["rankings"]>({
    honor: [],
    assets: [],
  });
  const [announcements, setAnnouncements] = useState<LobbyAnnouncement[]>([]);
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);
  const router = useRouter();
  const rankingPanels = rankingPanelMeta.map((panel) => ({
    ...panel,
    rows: rankingRows[panel.id],
  }));
  const activeAnnouncement = announcements[activeAnnouncementIndex] ?? null;
  const selectedDepartmentName =
    departments.find((department) => department.id === selectedDepartmentId)?.name ?? "";

  const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 8);

  useEffect(() => {
    let isMounted = true;

    async function loadRankings() {
      setIsLoadingRankings(true);

      const params = new URLSearchParams();

      if (selectedDepartmentId) {
        params.set("departmentId", selectedDepartmentId);
      }

      const response = await fetch(`/api/lobby/rankings${params.size ? `?${params.toString()}` : ""}`);

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setRankingRows({ honor: [], assets: [] });
        setIsLoadingRankings(false);
        return;
      }

      const payload = (await response.json()) as LobbyRankings;
      setDepartments(payload.departments);
      setRankingRows(payload.rankings);

      if (payload.selectedDepartmentId && payload.selectedDepartmentId !== selectedDepartmentId) {
        setSelectedDepartmentId(payload.selectedDepartmentId);
      }

      setIsLoadingRankings(false);
    }

    loadRankings();

    return () => {
      isMounted = false;
    };
  }, [selectedDepartmentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadAnnouncements() {
      if (!selectedDepartmentId) {
        setAnnouncements([]);
        setActiveAnnouncementIndex(0);
        return;
      }

      setIsLoadingAnnouncements(true);
      setActiveAnnouncementIndex(0);

      const params = new URLSearchParams({ departmentId: selectedDepartmentId });
      const response = await fetch(`/api/lobby/announcements?${params.toString()}`);

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setAnnouncements([]);
        setIsLoadingAnnouncements(false);
        return;
      }

      const payload = (await response.json()) as { announcements?: LobbyAnnouncement[] };
      setAnnouncements(payload.announcements ?? []);
      setIsLoadingAnnouncements(false);
    }

    loadAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (announcements.length < 2) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveAnnouncementIndex((currentIndex) => (currentIndex + 1) % announcements.length);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [activeAnnouncementIndex, announcements.length, selectedDepartmentId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage]);

  const handleNumberClick = (num: number) => {
    setErrorMessage("");
    if (phone.length < 8) {
      setPhone(phone + num.toString());
    }
  };

  const handlePhoneChange = (value: string) => {
    setErrorMessage("");
    setPhone(formatPhone(value));
  };

  const handleDelete = () => {
    setErrorMessage("");
    setPhone(phone.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (phone.length !== 8) {
      setErrorMessage("전화번호 8자리를 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const response = await fetch("/api/student/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, departmentId: selectedDepartmentId || undefined }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(payload?.error ?? "등록되지 않은 전화번호입니다. 다시 확인해주세요!");
      setPhone("");
      setIsSubmitting(false);
      return;
    }

    const payload = (await response.json()) as { students: LoginStudent[] };
    const students = payload.students ?? [];

    if (students.length === 1) {
      router.push(`/dashboard?studentId=${students[0].id}`);
      return;
    }

    setStudentChoices(students);
    setIsSubmitting(false);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 pb-4 pt-24 xl:flex-row xl:items-center xl:gap-5 xl:px-6 xl:pb-6 xl:pt-20">
      <div className="absolute left-6 top-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
        <label htmlFor="department-select" className="text-sm font-black text-slate-500">
          가맹점
        </label>
        <select
          id="department-select"
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
          disabled={departments.length === 0}
          className="min-w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white"
        >
          {departments.length === 0 ? (
            <option value="">가맹점 없음</option>
          ) : (
            departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))
          )}
        </select>
      </div>

      <Link
        href="/admin"
        className="absolute right-6 top-6 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-500 shadow-sm transition hover:bg-blue-600 hover:text-white"
      >
        관리자
      </Link>

      <section className="w-full max-w-xs overflow-hidden rounded-2xl border-t-4 border-amber-400 bg-white shadow-md xl:w-[250px]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-amber-600">{selectedDepartmentName || "가맹점"} 공지</p>
            <p className="mt-1 truncate text-sm font-black text-slate-800">
              {isLoadingAnnouncements
                ? "공지를 불러오는 중"
                : activeAnnouncement?.title ?? "현재 표시할 공지가 없습니다"}
            </p>
          </div>
          {activeAnnouncement && (
            <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
              {announcementTypeLabels[activeAnnouncement.type]}
            </span>
          )}
        </div>

        {activeAnnouncement && (
          <div className="max-h-56 overflow-y-auto px-4 py-3">
            <p className="text-xs font-bold text-slate-400">
              {activeAnnouncement.startDate} ~ {activeAnnouncement.endDate}
            </p>
            {activeAnnouncement.details && (
              <p className="mt-2 whitespace-pre-wrap text-xs font-bold leading-5 text-slate-600">
                {activeAnnouncement.details}
              </p>
            )}
            {activeAnnouncement.type === "award" && activeAnnouncement.awardStudents.length > 0 && (
              <div className="mt-3 grid gap-2">
                {activeAnnouncement.awardStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold"
                  >
                    <span className="truncate text-slate-700">{student.studentName}</span>
                    <span className="shrink-0 text-blue-600">{student.awardName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {announcements.length > 1 && (
          <div className="flex justify-center gap-2 border-t border-slate-100 px-4 py-2">
            {announcements.map((announcement, index) => (
              <button
                key={announcement.id}
                type="button"
                aria-label={`${index + 1}번째 공지 보기`}
                onClick={() => setActiveAnnouncementIndex(index)}
                className={`h-2 w-2 rounded-full ${
                  index === activeAnnouncementIndex ? "bg-amber-500" : "bg-slate-300"
                }`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex w-full max-w-sm flex-col gap-3 xl:w-[320px]">
        {rankingPanels.map((panel) => (
          <div key={panel.id} className={`rounded-2xl border-t-4 ${panel.borderClass} bg-white p-4 shadow-md`}>
            <h2 className="mb-3 text-center text-lg font-bold text-gray-800">
              {panel.title}
            </h2>
            <ul className="flex flex-col gap-2">
              {isLoadingRankings ? (
                <li className="rounded-xl bg-slate-50 p-3 text-center text-sm font-black text-slate-400">
                  랭킹 불러오는 중
                </li>
              ) : panel.rows.length === 0 ? (
                <li className="rounded-xl bg-slate-50 p-3 text-center text-sm font-black text-slate-400">
                  표시할 학생이 없습니다
                </li>
              ) : (
                panel.rows.map((row, index) => (
                  <li
                    key={row.id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-sm font-bold ${
                      index === 0
                        ? `rounded-xl ${panel.highlightClass}`
                        : "border-b border-slate-100 text-gray-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="mr-2">{index + 1}위</span>
                      <span>{row.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{row.grade}</span>
                    </span>
                    <span className="shrink-0">{row.points.toLocaleString()} DP</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex w-full max-w-xl flex-col items-center rounded-3xl bg-white p-6 shadow-xl xl:w-[520px]">
        <h1 className="mb-2 text-3xl font-bold text-blue-600">학생 포인트 시스템</h1>
        <p className="mb-6 text-sm text-gray-500">학부모 전화번호 뒷자리를 입력해주세요</p>

        <div className="flex w-full flex-col items-center gap-8">
          {errorMessage && (
            <div className="w-full rounded-2xl border border-red-400/80 bg-red-50 px-5 py-4 text-center text-sm font-black text-red-700 shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_0_22px_rgba(248,113,113,0.45)]">
              {errorMessage}
            </div>
          )}

          <div className="flex w-full items-end justify-center gap-4 rounded-3xl bg-slate-100/80 px-6 py-5 shadow-inner">
            <span className="pb-1 text-4xl font-black tracking-wider text-slate-900">010</span>
            <span className="pb-1 text-4xl font-black text-slate-400">-</span>
            <input
              type="tel"
              value={"*".repeat(phone.length)}
              onChange={(event) => handlePhoneChange(event.target.value)}
              onBeforeInput={(event) => {
                const input = event.data ?? "";

                if (/^\d$/.test(input)) {
                  event.preventDefault();
                  handleNumberClick(Number(input));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSubmit();
                  return;
                }

                if (event.key === "Backspace") {
                  event.preventDefault();
                  handleDelete();
                }
              }}
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
              maxLength={8}
              aria-label="학부모 전화번호 뒷자리"
              placeholder="12345678"
              className="h-14 w-72 min-w-0 border-0 border-b-2 border-slate-300 bg-transparent px-1 text-center text-4xl font-black leading-none tracking-widest text-slate-900 caret-blue-600 outline-none transition placeholder:text-slate-300 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="h-20 w-20 rounded-2xl bg-slate-100 text-3xl font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95 active:bg-slate-300"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDelete}
              className="h-20 w-20 rounded-2xl bg-red-50 text-3xl font-bold text-red-500 shadow-sm transition-all hover:bg-red-100 active:scale-95 active:bg-red-200"
            >
              ←
            </button>
            <button
              onClick={() => handleNumberClick(0)}
              className="h-20 w-20 rounded-2xl bg-slate-100 text-3xl font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95 active:bg-slate-300"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-20 w-20 rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 active:bg-blue-800"
            >
              {isSubmitting ? "..." : "완료"}
            </button>
          </div>
        </div>
      </section>

      {studentChoices.length > 1 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-6">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-900">학생을 선택해주세요</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                같은 학부모 연락처로 등록된 학생이 있어요.
              </p>
            </div>

            <div className="space-y-3">
              {studentChoices.map((student) => (
                <button
                  key={student.id}
                  onClick={() => router.push(`/dashboard?studentId=${student.id}`)}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-5 py-4 text-left transition hover:bg-blue-50"
                >
                  <span>
                    <span className="block text-lg font-black text-slate-900">{student.name}</span>
                    <span className="text-sm font-bold text-slate-400">{student.grade}</span>
                  </span>
                  <span className="font-black text-blue-600">{student.points.toLocaleString()} DP</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setStudentChoices([]);
                setPhone("");
              }}
              className="mt-5 w-full rounded-2xl bg-slate-100 py-3 font-bold text-slate-500 transition hover:bg-slate-200"
            >
              다시 입력
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
