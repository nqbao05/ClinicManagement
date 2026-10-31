"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getAccessToken, clearAuthSession, UserSession } from "@/lib/auth";
import { Activity, LogOut, ShieldCheck, UserCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<UserSession | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const currentToken = getAccessToken();
    const currentUser = getCurrentUser();

    if (!currentToken) {
      // Chưa đăng nhập thì chuyển về /login
      router.push("/login");
      return;
    }

    setToken(currentToken);
    setUser(currentUser);
  }, [router]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Top Navbar */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 dark:text-white">
                ClinicCare Dashboard
              </h1>
              <p className="text-xs text-slate-500">Hệ thống Y tế Đa cơ sở</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng xuất</span>
          </Button>
        </header>

        {/* User Profile Card */}
        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Xin chào, {user?.username || "Bác sĩ / Nhân viên"}!</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Đăng nhập thành công với phiên làm việc bảo mật JWT
                </CardDescription>
              </div>
              <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Phiên trực tuyến
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                  Vai trò (Role)
                </div>
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  {user?.roleId || "ROLE_DOCTOR"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                  Cơ sở / Chi nhánh
                </div>
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  {user?.branchId || "Branch_HN_01"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border space-y-1">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Trạng thái bảo mật
                </div>
                <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                  Access Token Đã Lưu
                </div>
              </div>
            </div>

            {/* Token Preview */}
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono break-all space-y-1">
              <span className="text-slate-400 font-sans font-semibold block text-[11px]">
                JWT Access Token (Stored in LocalStorage):
              </span>
              <p className="line-clamp-2 text-cyan-400">{token || "..."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

