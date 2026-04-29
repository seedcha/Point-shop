"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginStudent = {
  id: string;
  name: string;
  parent_phone: string;
  grade: string;
  points: number;
};

export default function LobbyPage() {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentChoices, setStudentChoices] = useState<LoginStudent[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 8);

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
      body: JSON.stringify({ phone }),
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
    <main className="relative flex min-h-screen flex-row items-center justify-center gap-8 bg-slate-100 p-6">
      <Link
        href="/admin"
        className="absolute right-6 top-6 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-500 shadow-sm transition hover:bg-blue-600 hover:text-white"
      >
        관리자
      </Link>

      <section className="flex w-1/3 max-w-sm flex-col gap-6">
        <div className="rounded-3xl border-t-4 border-blue-500 bg-white p-5 shadow-md">
          <h2 className="mb-4 text-center text-xl font-bold text-gray-800">
            명예의 전당 누적 포인트
          </h2>
          <ul className="flex flex-col gap-3">
            <li className="flex items-center justify-between rounded-xl bg-blue-50 p-3 font-bold text-blue-700">
              <span>1위 박개발</span>
              <span>120,400 P</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-100 p-3 font-semibold text-gray-700">
              <span>2위 이코딩</span>
              <span>98,500 P</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-100 p-3 font-semibold text-gray-700">
              <span>3위 김학생</span>
              <span>85,200 P</span>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border-t-4 border-emerald-500 bg-white p-5 shadow-md">
          <h2 className="mb-4 text-center text-xl font-bold text-gray-800">
            현재 보유 자산 랭킹
          </h2>
          <ul className="flex flex-col gap-3">
            <li className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">
              <span>1위 최프로</span>
              <span>45,000 P</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-100 p-3 font-semibold text-gray-700">
              <span>2위 김학생</span>
              <span>15,000 P</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-100 p-3 font-semibold text-gray-700">
              <span>3위 정백엔</span>
              <span>8,100 P</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="flex w-1/2 max-w-xl flex-col items-center rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-3xl font-bold text-blue-600">학생 포인트 시스템</h1>
        <p className="mb-8 text-sm text-gray-500">학부모 전화번호 뒷자리를 입력해주세요</p>

        <div className="flex w-full flex-col items-center gap-8">
          {errorMessage && (
            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-black text-amber-700">
              {errorMessage}
            </div>
          )}

          <div className="flex w-full items-end justify-center gap-4 rounded-3xl bg-slate-100/80 px-6 py-5 shadow-inner">
            <span className="pb-1 text-4xl font-black tracking-wider text-slate-900">010</span>
            <span className="pb-1 text-4xl font-black text-slate-400">-</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSubmit();
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
