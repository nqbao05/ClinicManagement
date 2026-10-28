import { Metadata } from "next";
import { LoginForm } from "@/components/organisms/login-form";
import { Activity, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Đăng nhập | Hệ thống Quản lý Y tế Đa cơ sở",
  description:
    "Cổng xác thực an toàn dành cho Bác sĩ, Nhân viên y tế và Bệnh nhân phòng khám đa cơ sở.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ================= PHÔNG NỀN MÀU MÈ VIBRANT MESH GRADIENT ================= */}
      {/* Lưới họa tiết Grid tinh tế */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800f_1px,transparent_1px),linear-gradient(to_bottom,#8080800f_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

      {/* Vệt màu 1: Cyan / Blue Gradient khổng lồ phía trên bên trái */}
      <div className="absolute -top-32 -left-32 w-96 h-96 sm:w-[500px] sm:h-[500px] bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 rounded-full blur-[100px] opacity-35 dark:opacity-20 animate-pulse-slow pointer-events-none" />

      {/* Vệt màu 2: Indigo / Purple Gradient rực rỡ góc trên bên phải */}
      <div className="absolute top-10 -right-24 w-80 h-80 sm:w-[450px] sm:h-[450px] bg-gradient-to-bl from-purple-500 via-indigo-500 to-pink-500 rounded-full blur-[100px] opacity-30 dark:opacity-20 pointer-events-none" />

      {/* Vệt màu 3: Emerald / Teal Gradient góc dưới bên trái */}
      <div className="absolute -bottom-28 left-10 w-80 h-80 sm:w-[400px] sm:h-[400px] bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 rounded-full blur-[100px] opacity-30 dark:opacity-15 pointer-events-none" />

      {/* Vệt màu 4: Rose / Amber rực rỡ góc dưới bên phải */}
      <div className="absolute -bottom-20 -right-20 w-80 h-80 sm:w-[420px] sm:h-[420px] bg-gradient-to-tl from-rose-400 via-fuchsia-500 to-indigo-500 rounded-full blur-[110px] opacity-25 dark:opacity-15 pointer-events-none" />

      {/* ================= KHỐI NỘI DUNG CĂN GIỮA HOÀN HẢO ================= */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo & Tên thương hiệu phòng khám */}
        <div className="mb-6 flex flex-col items-center space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-sm backdrop-blur-md mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[12px] font-medium bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 inline" />
              Hệ thống phòng khám liên thông HN & HCM
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30">
              <Activity className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              Clinic<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Care</span>{" "}
              <span className="text-sm font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 align-middle">
                Distributed
              </span>
            </h1>
          </div>
        </div>

        {/* Component LoginForm (Organism) */}
        <LoginForm redirectUrl="/dashboard" />

        {/* Security Trust Badges */}
        <div className="mt-6 flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 select-none bg-white/60 dark:bg-slate-900/60 px-4 py-2 rounded-full border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Mã hóa AES-256 • Phân quyền RBAC • Chống Brute Force</span>
        </div>
      </div>
    </main>
  );
}
