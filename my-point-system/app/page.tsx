"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 🚀 임시 데이터베이스 (가짜 DB)
const mockDB = [
  { name: "김학생", phone: "12345678", point: 15000 },
  { name: "이코딩", phone: "11112222", point: 8000 },
  { name: "박개발", phone: "87654321", point: 120400 },
];

export default function Home() {
  const [phone, setPhone] = useState("");
  const router = useRouter(); // 페이지 이동 도구

  // 숫자 키패드 클릭
  const handleNumberClick = (num: number) => {
    if (phone.length < 8) {
      setPhone(phone + num.toString());
    }
  };

  // 지우기
  const handleDelete = () => {
    setPhone(phone.slice(0, -1));
  };

  // 완료 (로그인 확인)
  const handleSubmit = () => {
    if (phone.length === 8) {
      const user = mockDB.find((student) => student.phone === phone);

      if (user) {
        // 학생이 존재하면 대시보드로 이동
        router.push(`/dashboard?name=${user.name}&point=${user.point}&phone=${user.phone}`);
      } else {
        alert("등록되지 않은 전화번호입니다. 다시 확인해주세요!");
        setPhone(""); // 입력창 초기화
      }
    } else {
      alert("전화번호 8자리를 모두 입력해주세요.");
    }
  };

  return (
    <div className="flex flex-row items-center justify-center min-h-screen bg-slate-100 p-6 gap-8">
      
      {/* ---------------- [왼쪽] 랭킹 영역 ---------------- */}
      <div className="flex flex-col gap-6 w-1/3 max-w-sm">
        
        {/* 누적 포인트 랭킹 (명예의 전당) */}
        <div className="bg-white p-5 rounded-3xl shadow-md border-t-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
            🏆 명예의 전당 (누적 포인트)
          </h2>
          <ul className="flex flex-col gap-3">
            <li className="flex justify-between items-center bg-blue-50 p-3 rounded-xl font-bold text-blue-700">
              <span>1위 박개발</span>
              <span>120,400 P</span>
            </li>
            <li className="flex justify-between items-center p-3 font-semibold text-gray-700 border-b border-slate-100">
              <span>2위 이코딩</span>
              <span>98,500 P</span>
            </li>
            <li className="flex justify-between items-center p-3 font-semibold text-gray-700 border-b border-slate-100">
              <span>3위 김학생</span>
              <span>85,200 P</span>
            </li>
          </ul>
        </div>

        {/* 현재 포인트 랭킹 (보유 자산) */}
        <div className="bg-white p-5 rounded-3xl shadow-md border-t-4 border-emerald-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
            💰 현재 보유 자산 랭킹
          </h2>
          <ul className="flex flex-col gap-3">
            <li className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl font-bold text-emerald-700">
              <span>1위 최프론</span>
              <span>45,000 P</span>
            </li>
            <li className="flex justify-between items-center p-3 font-semibold text-gray-700 border-b border-slate-100">
              <span>2위 김학생</span>
              <span>15,000 P</span>
            </li>
            <li className="flex justify-between items-center p-3 font-semibold text-gray-700 border-b border-slate-100">
              <span>3위 정백엔</span>
              <span>8,100 P</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ---------------- [오른쪽] 로그인 영역 ---------------- */}
      <div className="bg-white p-8 rounded-3xl shadow-xl w-1/2 max-w-xl flex flex-col items-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">학생 포인트 시스템</h1>
        <p className="text-gray-500 mb-8 text-sm">학부모 전화번호 뒷자리를 입력해주세요</p>

        {/* 입력 및 키패드 묶음 */}
        <div className="flex flex-col items-center gap-8 w-full">
          
          {/* 전화번호 입력 필드 */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl w-full justify-center border border-slate-200">
            <span className="text-4xl font-extrabold text-gray-800 tracking-wider">010</span>
            <span className="text-4xl font-extrabold text-gray-400">-</span>
            <input
              type="text"
              value={phone}
              readOnly
              placeholder="--------"
              className="text-4xl font-extrabold text-gray-800 w-52 text-center bg-transparent focus:outline-none tracking-widest placeholder:text-gray-300"
            />
          </div>

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-3xl font-bold text-slate-700 w-20 h-20 rounded-2xl shadow-sm transition-all active:scale-95"
              >
                {num}
              </button>
            ))}
            {/* 마지막 줄 */}
            <button 
              onClick={handleDelete}
              className="bg-red-50 hover:bg-red-100 active:bg-red-200 text-3xl font-bold text-red-500 w-20 h-20 rounded-2xl shadow-sm transition-all active:scale-95"
            >
              ←
            </button>
            <button 
              onClick={() => handleNumberClick(0)}
              className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-3xl font-bold text-slate-700 w-20 h-20 rounded-2xl shadow-sm transition-all active:scale-95"
            >
              0
            </button>
            <button 
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xl font-bold text-white w-20 h-20 rounded-2xl shadow-sm transition-all active:scale-95"
            >
              완료
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}