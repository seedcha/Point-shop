"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";

type AdminRole = "master" | "manager" | "staff";
type Achievement = {
  id: string;
  code: string;
  name: string;
  category: string;
  rarity: "common" | "rare" | "heroic" | "legendary" | "mythic";
  description: string;
  imageUrl: string | null;
  conditionType: string;
  conditionValue: number | null;
  conditionUnit: string | null;
  isAutomatic: boolean;
  sortOrder: number;
};
type EligibleStudent = {
  id: string;
  name: string;
  grade: string;
  parent_phone: string;
};

const DEFAULT_BADGE_IMAGE = "/achievements/default-badge.png";
const rarityMeta: Record<
  Achievement["rarity"],
  { label: string; badge: string; border: string }
> = {
  common: { label: "일반", badge: "bg-slate-100 text-slate-700", border: "border-slate-300" },
  rare: { label: "희귀", badge: "bg-blue-50 text-blue-700", border: "border-blue-400" },
  heroic: { label: "영웅", badge: "bg-orange-50 text-orange-700", border: "border-orange-400" },
  legendary: { label: "전설", badge: "bg-amber-50 text-amber-700", border: "border-amber-400" },
  mythic: { label: "신화", badge: "bg-red-50 text-red-700", border: "border-red-500" },
};

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function AchievementManagementView({
  departmentId,
  role,
}: {
  departmentId: string;
  role: AdminRole;
}) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [awardAchievement, setAwardAchievement] = useState<Achievement | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isAwarding, setIsAwarding] = useState(false);
  const imageInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const canDelete = role === "master" || role === "manager";

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    const phoneQuery = query.replace(/\D/g, "");
    if (!query) return eligibleStudents;
    return eligibleStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        Boolean(phoneQuery && student.parent_phone.replace(/\D/g, "").includes(phoneQuery))
    );
  }, [eligibleStudents, studentSearch]);

  const loadAchievements = useCallback(async () => {
    if (!departmentId) {
      setAchievements([]);
      return;
    }
    setIsLoading(true);
    setMessage("");
    const params = new URLSearchParams({ departmentId });
    const response = await fetch(`/api/admin/achievements?${params}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    const payload = (await response.json().catch(() => null)) as {
      achievements?: Achievement[];
      error?: string;
    } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "칭호 목록을 불러오지 못했습니다.");
    } else {
      setAchievements(payload?.achievements ?? []);
    }
    setIsLoading(false);
  }, [departmentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAchievements();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAchievements]);

  const openAwardModal = async (achievement: Achievement) => {
    setAwardAchievement(achievement);
    setStudentSearch("");
    setSelectedStudentId("");
    setEligibleStudents([]);
    setIsLoadingStudents(true);
    const params = new URLSearchParams({ departmentId, achievementId: achievement.id });
    const response = await fetch(`/api/admin/achievements?${params}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    const payload = (await response.json().catch(() => null)) as {
      students?: EligibleStudent[];
      error?: string;
    } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "학생 목록을 불러오지 못했습니다.");
      setAwardAchievement(null);
    } else {
      setEligibleStudents(payload?.students ?? []);
    }
    setIsLoadingStudents(false);
  };

  const handleAward = async () => {
    if (!awardAchievement || !selectedStudentId) return;
    setIsAwarding(true);
    const response = await fetch("/api/admin/achievements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify({
        departmentId,
        achievementId: awardAchievement.id,
        studentId: selectedStudentId,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "칭호를 지급하지 못했습니다.");
    } else {
      const student = eligibleStudents.find((item) => item.id === selectedStudentId);
      setMessage(`${student?.name ?? "학생"}에게 ${awardAchievement.name} 칭호를 지급했습니다.`);
      setAwardAchievement(null);
    }
    setIsAwarding(false);
  };

  const handleImageUpload = async (
    achievement: Achievement,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingId(achievement.id);
    const formData = new FormData();
    formData.set("departmentId", departmentId);
    formData.set("achievementId", achievement.id);
    formData.set("file", file);
    const response = await fetch("/api/admin/achievement-images", {
      method: "POST",
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as {
      imageUrl?: string;
      error?: string;
    } | null;
    if (!response.ok || !payload?.imageUrl) {
      setMessage(payload?.error ?? "칭호 이미지를 변경하지 못했습니다.");
    } else {
      setAchievements((current) =>
        current.map((item) =>
          item.id === achievement.id ? { ...item, imageUrl: payload.imageUrl ?? null } : item
        )
      );
      setMessage(`${achievement.name} 이미지를 변경했습니다.`);
    }
    setUploadingId("");
  };

  const handleDelete = async (achievement: Achievement) => {
    if (
      !canDelete ||
      !window.confirm(`${achievement.name} 칭호와 학생 보유 기록을 모두 삭제하시겠습니까?`)
    ) {
      return;
    }
    setDeletingId(achievement.id);
    const params = new URLSearchParams({ id: achievement.id, departmentId });
    const response = await fetch(`/api/admin/achievements?${params}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? "칭호를 삭제하지 못했습니다.");
    } else {
      setAchievements((current) => current.filter((item) => item.id !== achievement.id));
      setMessage(`${achievement.name} 칭호를 삭제했습니다.`);
    }
    setDeletingId("");
  };

  if (!departmentId) {
    return (
      <div className="mt-8 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center font-bold text-slate-500">
        가맹점을 선택하면 칭호 목록이 표시됩니다.
      </div>
    );
  }

  return (
    <div className="mt-8">
      {message && (
        <div className="mb-5 rounded-lg bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[84px_90px_180px_minmax(280px,1fr)_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black text-slate-500">
            <span>칭호 이미지</span>
            <span>칭호 등급</span>
            <span>칭호 이름</span>
            <span>칭호 지급 조건</span>
            <span>관리</span>
          </div>
          <div className="divide-y divide-slate-100">
            {achievements.map((achievement) => {
              const rarity = rarityMeta[achievement.rarity];
              return (
                <div
                  key={achievement.id}
                  className="grid grid-cols-[84px_90px_180px_minmax(280px,1fr)_180px] items-center gap-4 px-5 py-4"
                >
                  <div>
                    <input
                      ref={(node) => {
                        imageInputs.current[achievement.id] = node;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => handleImageUpload(achievement, event)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      title="칭호 이미지 변경"
                      disabled={uploadingId === achievement.id}
                      onClick={() => imageInputs.current[achievement.id]?.click()}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 bg-white hover:brightness-95 disabled:opacity-50 ${rarity.border}`}
                    >
                      <img
                        src={achievement.imageUrl || DEFAULT_BADGE_IMAGE}
                        alt={`${achievement.name} 칭호`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${rarity.badge}`}>
                    {rarity.label}
                  </span>
                  <div>
                    <p className="font-black text-slate-900">{achievement.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {achievement.isAutomatic ? "자동 지급" : "직접 지급"}
                    </p>
                  </div>
                  <p className="text-sm font-bold leading-6 text-slate-600">
                    {achievement.description}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openAwardModal(achievement)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
                    >
                      칭호 지급
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === achievement.id}
                        onClick={() => handleDelete(achievement)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <p className="px-5 py-12 text-center font-bold text-slate-400">칭호를 불러오는 중입니다.</p>
            )}
            {!isLoading && achievements.length === 0 && (
              <p className="px-5 py-12 text-center font-bold text-slate-400">등록된 칭호가 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      {awardAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5">
          <section className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <img
                src={awardAchievement.imageUrl || DEFAULT_BADGE_IMAGE}
                alt=""
                className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
              />
              <div>
                <p className="text-sm font-black text-blue-600">칭호 지급</p>
                <h3 className="mt-1 text-xl font-black">{awardAchievement.name}</h3>
              </div>
            </div>
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="학생 이름 또는 학부모 번호 검색"
              className="mt-5 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
            />
            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              {filteredStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="achievement-student"
                    checked={selectedStudentId === student.id}
                    onChange={() => setSelectedStudentId(student.id)}
                    className="h-4 w-4"
                  />
                  <span>
                    <span className="block font-black text-slate-800">{student.name}</span>
                    <span className="text-xs font-bold text-slate-400">
                      {student.grade} · {student.parent_phone}
                    </span>
                  </span>
                </label>
              ))}
              {!isLoadingStudents && filteredStudents.length === 0 && (
                <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                  이 칭호가 없는 학생이 없습니다.
                </p>
              )}
              {isLoadingStudents && (
                <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                  학생을 불러오는 중입니다.
                </p>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!selectedStudentId || isAwarding}
                onClick={handleAward}
                className="rounded-lg bg-blue-600 py-3 font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                지급
              </button>
              <button
                type="button"
                disabled={isAwarding}
                onClick={() => setAwardAchievement(null)}
                className="rounded-lg bg-slate-100 py-3 font-black text-slate-600 hover:bg-slate-200"
              >
                취소
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
