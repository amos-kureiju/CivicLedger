import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  authenticateUser,
  changePasswordForUser,
  confirmPasswordReset,
  createSignedSessionToken,
  registerNewCommunityAccount,
  requestPasswordResetOtp,
  resetAuthDemoStore,
  verifySignedSessionToken,
} from "@/lib/server-auth";
import { AuthRole } from "@/lib/types";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySignedSessionToken(token);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "LOGIN") {
      const result = authenticateUser(
        String(body.identifier || ""),
        String(body.password || "")
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      const token = createSignedSessionToken(result.user);
      const res = NextResponse.json({ ok: true, user: result.user });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
      return res;
    }

    if (action === "REGISTER") {
      const role: AuthRole =
        body.role === "COORDINATOR" ||
        body.role === "MERCHANT" ||
        body.role === "BENEFICIARY"
          ? body.role
          : "BENEFICIARY";

      const result = registerNewCommunityAccount({
        name: String(body.name || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
        password: String(body.password || ""),
        role,
        rt_rw: body.rt_rw ? String(body.rt_rw) : undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const token = createSignedSessionToken(result.user);
      const res = NextResponse.json(
        { ok: true, user: result.user },
        { status: 201 }
      );
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
      return res;
    }

    if (action === "REQUEST_RESET") {
      const result = requestPasswordResetOtp(String(body.identifier || ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        account_name: result.account_name,
        masked_contact: result.masked_contact,
        demo_otp_code: result.demo_otp_code,
        expires_in_minutes: result.expires_in_minutes,
        message: `Kode verifikasi 6 angka untuk ${result.account_name} sudah dibuat (berlaku ${result.expires_in_minutes} menit).`,
      });
    }

    if (action === "CONFIRM_RESET") {
      const result = confirmPasswordReset({
        identifier: String(body.identifier || ""),
        otp_code: String(body.otp_code || ""),
        new_password: String(body.new_password || ""),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        user: result.user,
        message: `Kata sandi untuk ${result.user.name} berhasil diperbarui! Silakan masuk dengan kata sandi baru.`,
      });
    }

    if (action === "CHANGE_PASSWORD") {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      const user = verifySignedSessionToken(token);
      if (!user) {
        return NextResponse.json(
          { error: "Sesi masuk sudah berakhir. Silakan masuk ulang." },
          { status: 401 }
        );
      }
      const result = changePasswordForUser({
        user_id: user.id,
        old_password: String(body.old_password || ""),
        new_password: String(body.new_password || ""),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        message: "Kata sandi Anda berhasil diganti.",
      });
    }

    if (action === "LOGOUT") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    if (action === "RESET_AUTH_DEMO") {
      resetAuthDemoStore();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Permintaan tidak dikenali." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
