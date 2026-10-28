"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { loginSchema, LoginInput } from "@/lib/validations/auth";
import { saveAuthSession, AuthResponseData } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type NetworkStatus = "idle" | "loading" | "error" | "success";

interface LoginFormProps {
  redirectUrl?: string;
}

export function LoginForm({ redirectUrl = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [networkStatus, setNetworkStatus] = React.useState<NetworkStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const isLoading = networkStatus === "loading" || isSubmitting;

  /**
   * Xử lý gửi Form Đăng nhập gọi API đến Backend NestJS:
   * 1. Loading State: Vô hiệu hóa nút và hiện Spinner xoay tròn
   * 2. Gọi API POST http://localhost:3001/api/v1/auth/login
   * 3. Lưu JWT Access Token & thông tin người dùng vào LocalStorage
   * 4. Error State: Hiển thị Alert đỏ thông báo lỗi chi tiết
   * 5. Success State: Hiển thị trạng thái thành công và chuyển hướng sang /dashboard
   */
  const onSubmit = async (data: LoginInput) => {
    // 1. Chuyển sang Loading State
    setNetworkStatus("loading");
    setErrorMessage(null);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    let targetEndpoint = baseUrl ? `${baseUrl}/api/v1/auth/login` : "/api/v1/auth/login";

    try {
      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Rất quan trọng: cho phép trình duyệt nhận Set-Cookie refresh_token từ Backend
        body: JSON.stringify({
          username: data.email, // NestJS Auth DTO nhận username (hỗ trợ email)
          email: data.email,
          password: data.password,
        }),
      };

      let response = await fetch(targetEndpoint, requestOptions);

      // Tự động thử lại với /auth/login nếu endpoint có prefix trả về 404
      if (response.status === 404) {
        targetEndpoint = baseUrl ? `${baseUrl}/auth/login` : "/api/auth/login";
        response = await fetch(targetEndpoint, requestOptions);
      }

      const result: AuthResponseData = await response.json().catch(() => ({
        accessToken: "",
        message: "Không thể phân tích phản hồi từ máy chủ.",
      }));

      // ================= 2. ERROR STATE (FALLBACK UI) =================
      if (!response.ok) {
        let message = "Đã xảy ra lỗi không xác định từ hệ thống.";

        if (response.status === 401) {
          message = (typeof result.message === "string" ? result.message : null) ||
            "Tài khoản hoặc mật khẩu không chính xác.";
        } else if (response.status === 423) {
          message = (typeof result.message === "string" ? result.message : null) ||
            "Tài khoản đang bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.";
        } else if (response.status === 429) {
          message = "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau giây lát.";
        } else if (result?.message) {
          message = Array.isArray(result.message) ? result.message.join(", ") : result.message;
        }

        setErrorMessage(message);
        setNetworkStatus("error");
        return;
      }

      // ================= 3. SUCCESS STATE =================
      // Lưu JWT Access Token và thông tin User vào LocalStorage
      if (result.accessToken) {
        saveAuthSession(result);
      }

      setNetworkStatus("success");

      // Chuyển hướng người dùng sang trang Dashboard
      router.push(redirectUrl);
    } catch (err: unknown) {
      // Bắt lỗi rớt mạng hoặc Backend chưa chạy
      setNetworkStatus("error");
      setErrorMessage(
        "Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra lại kết nối mạng."
      );
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl shadow-indigo-500/10 border border-white/60 dark:border-slate-800/80 backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 rounded-2xl overflow-hidden transition-all duration-300">
      {/* Thanh line gradient trang trí tinh tế trên đầu Card */}
      <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600" />

      <CardHeader className="space-y-2 text-center pt-6 pb-4">
        <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-indigo-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-indigo-800/50 shadow-inner">
          <Lock className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cổng Đăng Nhập
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Vui lòng nhập thông tin để truy cập hồ sơ bệnh án và lịch trực
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6 sm:px-8">
        {/* ================= 2. ERROR STATE (FALLBACK UI) ================= */}
        {networkStatus === "error" && errorMessage && (
          <Alert variant="destructive" className="animate-in fade-in-50 duration-200 rounded-xl border-destructive/30 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold text-xs sm:text-sm">Đăng nhập không thành công</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* ================= 3. SUCCESS STATE BANNER ================= */}
        {networkStatus === "success" && (
          <Alert className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 animate-in fade-in-50 duration-200 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="font-semibold text-xs sm:text-sm">Đăng nhập thành công</AlertTitle>
            <AlertDescription className="text-xs">
              Đã lưu JWT Access Token. Đang chuyển hướng sang Dashboard...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email / Username Field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Email / Tài khoản <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="bacsi.nguyenvana@clinic.vn"
                disabled={isLoading || networkStatus === "success"}
                aria-invalid={!!errors.email}
                className={`pl-10 h-11 rounded-xl transition-all border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 ${
                  errors.email ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive font-medium mt-1 pl-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                Mật khẩu <span className="text-destructive">*</span>
              </Label>
              <a
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline transition-colors"
                tabIndex={-1}
              >
                Quên mật khẩu?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={isLoading || networkStatus === "success"}
                aria-invalid={!!errors.password}
                className={`pl-10 pr-11 h-11 rounded-xl transition-all border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 ${
                  errors.password ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive font-medium mt-1 pl-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* ================= 1. LOADING STATE TRONG NÚT BẤM ================= */}
          <Button
            type="submit"
            className="w-full font-bold transition-all duration-300 mt-2 h-11 text-sm sm:text-base rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:via-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 active:scale-[0.99]"
            disabled={isLoading || networkStatus === "success"}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Đang kết nối máy chủ...</span>
              </div>
            ) : networkStatus === "success" ? (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-white" />
                <span>Đăng nhập thành công!</span>
              </div>
            ) : (
              <span>Đăng Nhập</span>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-1.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-5 text-center text-xs text-slate-500 dark:text-slate-400">
        <p className="font-medium text-slate-600 dark:text-slate-300">
          Dành cho Bác sĩ, Lễ tân và Bệnh nhân phòng khám
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Hệ thống bảo vệ dữ liệu tự động khóa phiên sau 15 phút không thao tác.
        </p>
      </CardFooter>
    </Card>
  );
}
