import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

async function getMasterProfile(request: NextRequest) {
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
    .select("id, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profile || profile.role !== "master") {
    return { error: "마스터 관리자만 사용할 수 있습니다.", status: 403 as const };
  }

  return { profile };
}

export async function GET(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const order = new URL(request.url).searchParams.get("order") === "oldest" ? true : false;
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: order });

  if (error) {
    return NextResponse.json({ error: "공지를 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as { content?: string };
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "공지 내용을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert({ title: "공지", content })
    .select("id, title, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "공지를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ announcement: data });
}

export async function PATCH(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const body = (await request.json()) as { id?: string; content?: string };
  const content = body.content?.trim();

  if (!body.id || !content) {
    return NextResponse.json({ error: "수정할 공지 내용을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .update({ content })
    .eq("id", body.id)
    .select("id, title, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "공지를 수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ announcement: data });
}

export async function DELETE(request: NextRequest) {
  const master = await getMasterProfile(request);

  if ("error" in master) {
    return NextResponse.json({ error: master.error }, { status: master.status });
  }

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "삭제할 공지를 선택해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "공지를 삭제하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
