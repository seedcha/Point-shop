"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { supabase } from "@/lib/supabase/client";

const PASSWORD_MIN_LENGTH = 6;

function formatAuthError(message: string | undefined) {
  if (message?.toLowerCase().includes("password should be at least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }

  return message || "비밀번호를 변경하지 못했습니다.";
}

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < PASSWORD_MIN_LENGTH) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    setIsSaving(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.");
    await supabase.auth.signOut();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <p className="text-sm font-black text-blue-600">POINT SYSTEM</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">비밀번호 재설정</h1>
        {message && (
          <div className="mt-6 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-600">새 비밀번호</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-600">새 비밀번호 확인</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>
          <button
            disabled={isSaving}
            className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isSaving ? "저장 중" : "변경"}
          </button>
        </form>
        <Link
          href="/admin"
          className="mt-4 block text-center text-sm font-bold text-slate-500 hover:text-blue-600"
        >
          관리자 로그인으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
