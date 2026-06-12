import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest } from "next/server";

const STUDENT_SESSION_COOKIE = "point-shop-student-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SELECTION_MAX_AGE_SECONDS = 60 * 5;

type SignedStudentPayload = {
  studentId: string;
  departmentId: string;
  exp: number;
  purpose: "selection" | "session";
};

function getSecret() {
  const secret = process.env.STUDENT_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("학생 세션 서명 키가 설정되지 않았습니다.");
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payload: SignedStudentPayload) {
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string, purpose: SignedStudentPayload["purpose"]) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSecret()).update(encodedPayload).digest();
  const received = Buffer.from(signature, "base64url");

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SignedStudentPayload;

    if (
      payload.purpose !== purpose ||
      !payload.studentId ||
      !payload.departmentId ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createStudentSelectionToken(studentId: string, departmentId: string) {
  return signPayload({
    studentId,
    departmentId,
    purpose: "selection",
    exp: Math.floor(Date.now() / 1000) + SELECTION_MAX_AGE_SECONDS,
  });
}

export function createStudentSessionToken(studentId: string, departmentId: string) {
  return signPayload({
    studentId,
    departmentId,
    purpose: "session",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyStudentSelectionToken(token: string) {
  return verifyToken(token, "selection");
}

export function getStudentSession(request: NextRequest) {
  const token = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  return token ? verifyToken(token, "session") : null;
}

export const studentSessionCookie = {
  name: STUDENT_SESSION_COOKIE,
  maxAge: SESSION_MAX_AGE_SECONDS,
};
