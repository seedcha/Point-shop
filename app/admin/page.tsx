"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type AdminAccount = {
  name: string;
  email: string;
  password: string;
  department: string;
};

const STORAGE_KEY = "coin-shop-admins";
const SIGNUP_PIN = "1234";
const DEPARTMENTS = ["운영", "교육", "상점", "관리"];

export default function AdminPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [accounts, setAccounts] = useState<AdminAccount[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as AdminAccount[]) : [];
  });
  const [session, setSession] = useState<AdminAccount | null>(null);
  const [message, setMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupDepartment, setSignupDepartment] = useState(DEPARTMENTS[0]);
  const [signupPin, setSignupPin] = useState("");

  const saveAccounts = (nextAccounts: AdminAccount[]) => {
    setAccounts(nextAccounts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAccounts));
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const account = accounts.find(
      (item) => item.email === loginEmail.trim() && item.password === loginPassword
    );

    if (!account) {
      setMessage("이메일 또는 비밀번호를 다시 확인해주세요.");
      return;
    }

    setSession(account);
  };

  const handleSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const email = signupEmail.trim();

    if (signupPassword.length < 4) {
      setMessage("비밀번호는 4자리 이상 입력해주세요.");
      return;
    }

    if (signupPassword !== signupConfirm) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (signupPin !== SIGNUP_PIN) {
      setMessage("관리자 가입 PIN이 올바르지 않습니다.");
      return;
    }

    if (accounts.some((account) => account.email === email)) {
      setMessage("이미 가입된 관리자 이메일입니다.");
      return;
    }

    const nextAccount = {
      name: signupName.trim(),
      email,
      password: signupPassword,
      department: signupDepartment,
    };

    saveAccounts([...accounts, nextAccount]);
    setLoginEmail(email);
    setLoginPassword("");
    setSignupName("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
    setSignupDepartment(DEPARTMENTS[0]);
    setSignupPin("");
    setMode("login");
    setMessage("회원가입이 완료되었습니다. 비밀번호를 입력해 로그인해주세요.");
  };

  if (session) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-bold text-slate-500 hover:text-blue-600">
            학생 화면
          </Link>
          <button
            onClick={() => setSession(null)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>

        <section className="mx-auto mt-20 max-w-5xl rounded-3xl bg-white p-10 shadow-xl">
          <p className="text-sm font-bold text-blue-600">{session.department} 부서</p>
          <h1 className="mt-3 text-3xl font-black text-slate-900">
            {session.name} 관리자님, 환영합니다.
          </h1>
          <p className="mt-3 text-slate-500">
            학생, 포인트, 상품, 출석 관리 기능을 이 화면에 이어서 붙이면 됩니다.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["학생 관리", "학생 등록 및 정보 수정"],
              ["포인트 관리", "포인트 지급 및 차감"],
              ["상품 관리", "상품 등록 및 재고 관리"],
            ].map(([title, description]) => (
              <button
                key={title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="text-lg font-black text-slate-800">{title}</span>
                <span className="mt-2 block text-sm font-medium text-slate-500">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

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
          <p className="mt-2 text-sm text-slate-500">
            관리자 계정으로 로그인하거나 새 계정을 등록하세요.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            className={`rounded-xl py-3 text-sm font-bold transition ${
              mode === "login" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            className={`rounded-xl py-3 text-sm font-bold transition ${
              mode === "signup" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            }`}
          >
            회원가입
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">이메일</span>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="admin@example.com"
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
            <button className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white transition hover:bg-blue-700">
              로그인
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="mt-6 space-y-4">
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
              <span className="text-sm font-bold text-slate-600">이메일</span>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="admin@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">비밀번호</span>
              <input
                type="password"
                required
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="4자리 이상"
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
              <span className="text-sm font-bold text-slate-600">부서 선택</span>
              <select
                required
                value={signupDepartment}
                onChange={(event) => setSignupDepartment(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
              >
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-600">관리자 가입 PIN</span>
              <input
                type="password"
                required
                inputMode="numeric"
                value={signupPin}
                onChange={(event) => setSignupPin(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="관리자 가입 PIN"
              />
            </label>
            <button className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white transition hover:bg-blue-700">
              회원가입
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
