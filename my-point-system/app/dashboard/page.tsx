"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "학생";
  const phone = searchParams.get("phone") || "00000000";
  const point = searchParams.get("point") || "0";

  const [activeMenu, setActiveMenu] = useState("dashboard");

  // --- 가짜 데이터 모음 ---
  // 1. 기본 정보 데이터
  const basicInfo = {
    studentId: "20260421",
    className: "웹 개발 기초반",
    regDate: "2026-03-02",
    attendanceThisMonth: 14,
  };

  // 2. 포인트 내역 데이터 (+, - 모두 포함)
  const pointHistory = [
    { id: 1, date: "2026-04-21 14:30", reason: "출석 보상", amount: 150, type: "plus" },
    { id: 2, date: "2026-04-20 16:00", reason: "과제 우수 제출", amount: 500, type: "plus" },
    { id: 3, date: "2026-04-18 15:20", reason: "초코 우유 구매", amount: -300, type: "minus" },
    { id: 4, date: "2026-04-15 14:30", reason: "출석 보상", amount: 150, type: "plus" },
  ];

  // 3. 구매 내역 데이터
  const purchaseHistory = [
    { id: 1, date: "2026-04-18 15:20", item: "초코 우유", price: 300, emoji: "🧋" },
    { id: 2, date: "2026-04-10 17:00", item: "고급 마우스", price: 8000, emoji: "🖱️" },
  ];

  // 4. 시간표 데이터
  const timetable = [
    { day: "월", subject: "수학", time: "14:00" },
    { day: "화", subject: "영어", time: "15:30" },
    { day: "수", subject: "웹개발", time: "14:00" },
    { day: "목", subject: "코딩", time: "16:00" },
    { day: "금", subject: "국어", time: "15:00" },
    { day: "토", subject: "창의미술", time: "11:00" },
    { day: "일", subject: "-", time: "-" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* ---------------- [왼쪽] 세로 사이드바 ---------------- */}
      <div className="w-64 bg-white shadow-xl flex flex-col border-r border-slate-200 z-10">
        <div className="p-8 text-center border-b border-slate-100">
          <h1 className="text-2xl font-black text-blue-600 tracking-wider">POINT<br/>SYSTEM</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveMenu("dashboard")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeMenu === "dashboard" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"}`}>
            🏠 개인 대시보드
          </button>
          <button onClick={() => setActiveMenu("shop")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeMenu === "shop" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"}`}>
            🛒 포인트 상점
          </button>
          <button onClick={() => setActiveMenu("timetable")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeMenu === "timetable" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"}`}>
            📅 주간 시간표
          </button>
          <button onClick={() => setActiveMenu("settings")} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${activeMenu === "settings" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"}`}>
            ⚙️ 환경 설정
          </button>
        </nav>

        <div className="p-6 border-t border-slate-100">
          <Link href="/">
            <button className="w-full py-3 text-sm font-bold text-red-400 bg-red-50 rounded-xl hover:bg-red-100 transition">로그아웃</button>
          </Link>
        </div>
      </div>

      {/* ---------------- [오른쪽] 메인 콘텐츠 영역 ---------------- */}
      <main className="flex-1 p-10 overflow-y-auto">
        
        {/* 상단 공통 헤더 */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              {activeMenu === "dashboard" && "🏠 개인 대시보드"}
              {activeMenu === "shop" && "🛒 포인트 상점"}
              {activeMenu === "timetable" && "📅 주간 시간표"}
              {activeMenu === "settings" && "⚙️ 설정"}
            </h2>
            <p className="text-slate-400 font-medium mt-1">
              {activeMenu === "dashboard" && "나의 활동 내역과 포인트를 한눈에 확인하세요."}
              {activeMenu !== "dashboard" && `${name} 학생, 오늘도 즐겁게 배워봐요!`}
            </p>
          </div>
          <div className="bg-white px-8 py-4 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
            <span className="text-slate-500 font-bold">보유 포인트</span>
            <span className="text-3xl font-black text-blue-600">{Number(point).toLocaleString()} P</span>
          </div>
        </header>

        <div className="min-h-[600px]">
          
          {/* ==================== 1. 개인 대시보드 화면 ==================== */}
          {activeMenu === "dashboard" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* [기본 정보] 영역 */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span>👤</span> 학생 기본 정보
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-400 font-bold mb-1">이름</p>
                    <p className="font-black text-lg text-slate-700">{name}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-400 font-bold mb-1">학번</p>
                    <p className="font-black text-lg text-slate-700">{basicInfo.studentId}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-400 font-bold mb-1">수강 클래스</p>
                    <p className="font-black text-lg text-blue-600">{basicInfo.className}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-sm text-slate-400 font-bold mb-1">등록일</p>
                    <p className="font-black text-lg text-slate-700">{basicInfo.regDate}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                    <p className="text-sm text-blue-500 font-bold mb-1">이번 달 출석</p>
                    <p className="font-black text-xl text-blue-700">{basicInfo.attendanceThisMonth}회</p>
                  </div>
                </div>
              </div>

              {/* 하단 2단 분할 영역 (포인트 내역 / 구매 내역) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* [포인트 내역] 영역 */}
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span>💰</span> 포인트 변동 내역
                  </h3>
                  <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                    {pointHistory.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-slate-700">{item.reason}</p>
                          <p className="text-sm text-slate-400">{item.date}</p>
                        </div>
                        <p className={`text-xl font-black ${item.type === "plus" ? "text-emerald-500" : "text-red-500"}`}>
                          {item.type === "plus" ? "+" : ""}{item.amount.toLocaleString()} P
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* [구매 내역] 영역 */}
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 h-96 flex flex-col">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span>🛍️</span> 상점 구매 내역
                  </h3>
                  <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                    {purchaseHistory.length > 0 ? (
                      purchaseHistory.map((item) => (
                        <div key={item.id} className="flex gap-4 items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-3xl">
                            {item.emoji}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-800 text-lg">{item.item}</p>
                            <p className="text-sm text-slate-400">{item.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-red-500 font-bold">- {item.price.toLocaleString()} P</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 font-bold">
                        아직 구매한 물건이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== 2. 포인트 상점 ==================== */}
          {activeMenu === "shop" && (
             <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
             {[
               { name: "맛있는 아이스크림", price: 500, emoji: "🍦" },
               { name: "초코 우유", price: 300, emoji: "🧋" },
               { name: "고급 키보드", price: 15000, emoji: "⌨️" },
               { name: "게이밍 마우스", price: 8000, emoji: "🖱️" },
             ].map((item, idx) => (
               <div key={idx} className="group p-6 border border-slate-100 rounded-3xl hover:shadow-xl transition-all cursor-pointer text-center bg-slate-50 hover:bg-white">
                 <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">{item.emoji}</div>
                 <h4 className="font-bold text-lg mb-2">{item.name}</h4>
                 <p className="text-blue-600 font-black">{item.price.toLocaleString()} P</p>
               </div>
             ))}
           </div>
          )}

          {/* ==================== 3. 주간 시간표 ==================== */}
          {activeMenu === "timetable" && (
             <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50 rounded-t-2xl">
                   <th className="p-6 font-bold text-slate-500 border-b">요일</th>
                   <th className="p-6 font-bold text-slate-500 border-b">수업명</th>
                   <th className="p-6 font-bold text-slate-500 border-b">시작 시간</th>
                 </tr>
               </thead>
               <tbody>
                 {timetable.map((t, idx) => (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                     <td className="p-6 font-black text-blue-600 text-lg">{t.day}</td>
                     <td className="p-6 font-bold text-slate-700">{t.subject}</td>
                     <td className="p-6 text-slate-400 font-medium">{t.time}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
          )}

          {/* ==================== 4. 설정 ==================== */}
          {activeMenu === "settings" && (
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 max-w-md space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">알림 설정</label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="flex-1 font-bold text-slate-700">포인트 획득 시 소리 재생</div>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative cursor-pointer"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow"></div></div>
                </div>
              </div>
              <button className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition">비밀번호 변경 (부모님 확인 필요)</button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}