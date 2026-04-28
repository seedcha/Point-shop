"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const mockDB = [
  { name: "김학생", phone: "12345678", point: 15000 },
  { name: "이코딩", phone: "11112222", point: 8000 },
  { name: "박개발", phone: "87654321", point: 120400 },
];

export default function LobbyPage() {
  const [phone, setPhone] = useState("");
  const router = useRouter();

  const handleNumberClick = (num: number) => {
    if (phone.length < 8) {
      setPhone(phone + num.toString());
    }
  };

  const handleDelete = () => {
    setPhone(phone.slice(0, -1));
  };

  const handleSubmit = () => {
    if (phone.length !== 8) {
      alert("전화번호 8자리를 모두 입력해주세요.");
      return;
    }

    const user = mockDB.find((student) => student.phone === phone);

    if (!user) {
      alert("등록되지 않은 전화번호입니다. 다시 확인해주세요!");
      setPhone("");
      return;
    }

    router.push(`/dashboard?name=${user.name}&point=${user.point}&phone=${user.phone}`);
  };

  return (
    <main className="flex min-h-screen flex-row items-center justify-center gap-8 bg-slate-100 p-6">
      <Link
        href="/admin"
        className="fixed right-8 top-8 z-20 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
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
          <div className="flex w-full items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4">
            <span className="text-4xl font-extrabold tracking-wider text-gray-800">010</span>
            <span className="text-4xl font-extrabold text-gray-400">-</span>
            <input
              type="text"
              value={phone}
              readOnly
              placeholder="--------"
              className="min-w-0 w-72 max-w-full bg-transparent px-3 text-center text-4xl font-extrabold tracking-wider text-gray-800 placeholder:text-gray-300 focus:outline-none"
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
              className="h-20 w-20 rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 active:bg-blue-800"
            >
              완료
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
