import { NextResponse } from "next/server";

// Giả lập cơ sở dữ liệu người dùng mẫu chuẩn Clean Architecture
const USERS_DB = [
  {
    userId: "usr_89f07a21-9e77-4c4f-9e77-628b3a0a3821",
    branchId: "branch_hn_01",
    roleId: "ROLE_DOCTOR",
    username: "bacsi.nguyenvana@clinic.vn",
    password: "DoctorSecret@2026",
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  },
  {
    userId: "usr_admin_01",
    branchId: "global",
    roleId: "ROLE_ADMIN",
    username: "admin@clinic.vn",
    password: "AdminSecret@2026",
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  },
  {
    userId: "usr_patient_01",
    branchId: "branch_hcm_01",
    roleId: "ROLE_PATIENT",
    username: "benhnhan@clinic.vn",
    password: "PatientSecret@2026",
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || body.email || "").trim().toLowerCase();
    const password = body.password || "";

    // 1. Kiểm tra tài khoản trong hệ thống
    const user = USERS_DB.find(
      (u) =>
        u.username.toLowerCase() === username ||
        u.username.split("@")[0].toLowerCase() === username
    );

    if (!user) {
      return NextResponse.json(
        {
          statusCode: 401,
          message: "Tài khoản hoặc mật khẩu không chính xác.",
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 2. Kiểm tra nếu tài khoản đang bị tạm khóa (423 Locked)
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      return NextResponse.json(
        {
          statusCode: 423,
          message: `Tài khoản đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
          remainingMinutes,
        },
        { status: 423 }
      );
    }

    // 3. Kiểm tra mật khẩu (hỗ trợ cả DoctorSecret@2026 và mật khẩu mẫu)
    const isMatch =
      password === user.password ||
      password === "DoctorSecret@2026" ||
      password === "P@ssw0rd123!";

    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        return NextResponse.json(
          {
            statusCode: 423,
            message: "Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.",
            remainingMinutes: 15,
          },
          { status: 423 }
        );
      }

      const remainingAttempts = 5 - user.failedLoginAttempts;
      return NextResponse.json(
        {
          statusCode: 401,
          message: `Tài khoản hoặc mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 4. Mật khẩu đúng -> Reset số lần thử & sinh Token
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    const dummyAccessToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
      JSON.stringify({
        sub: user.userId,
        username: user.username,
        role: user.roleId,
        branch_id: user.branchId,
        exp: Math.floor(Date.now() / 1000) + 900,
      })
    )}.signature_demo_clinic_2026`;

    const response = NextResponse.json(
      {
        accessToken: dummyAccessToken,
        tokenType: "Bearer",
        expiresIn: 900,
        user: {
          userId: user.userId,
          branchId: user.branchId,
          roleId: user.roleId,
          username: user.username,
          isActive: true,
        },
      },
      { status: 200 }
    );

    // Gắn HttpOnly Cookie refresh_token bảo mật
    response.cookies.set("refresh_token", "sample_refresh_token_family_7d", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { statusCode: 500, message: "Lỗi hệ thống máy chủ nội bộ" },
      { status: 500 }
    );
  }
}

