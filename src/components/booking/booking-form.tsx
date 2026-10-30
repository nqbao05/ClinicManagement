"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  CalendarPlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// DỮ LIỆU KHỞI TẠO MẪU (MOCK DATA)
// -----------------------------------------------------------------------------
export interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

export interface TimeSlotOption {
  id: string;
  label: string; // VD: 08:00 - 09:00
}

const DEFAULT_DOCTORS: Doctor[] = [
  { id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", name: "BS. CKI Nguyễn Văn A", specialty: "Nội tổng quát & Tim mạch" },
  { id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e", name: "ThS. BS Trần Thị B", specialty: "Nhi khoa & Hô hấp" },
  { id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f", name: "BS. CKII Lê Hoàng C", specialty: "Răng - Hàm - Mặt" },
];

const DEFAULT_SLOTS: TimeSlotOption[] = [
  { id: "slot-0800-0900", label: "08:00 - 09:00" },
  { id: "slot-0900-1000", label: "09:00 - 10:00" },
  { id: "slot-1000-1100", label: "10:00 - 11:00" },
  { id: "slot-1100-1200", label: "11:00 - 12:00" },
  { id: "slot-1330-1430", label: "13:30 - 14:30" },
  { id: "slot-1430-1530", label: "14:30 - 15:30" },
  { id: "slot-1530-1630", label: "15:30 - 16:30" },
  { id: "slot-1630-1730", label: "16:30 - 17:30" },
];

// Patient ID mẫu mặc định (nếu chưa tích hợp auth/session)
const DEFAULT_PATIENT_ID = "d3b07384-d113-4a15-8e3b-5c742918e5a1";

// -----------------------------------------------------------------------------
// COMPONENT CHÍNH: BookingForm
// -----------------------------------------------------------------------------
export interface BookingFormProps {
  apiBaseUrl?: string;
  patientId?: string;
  doctors?: Doctor[];
  slots?: TimeSlotOption[];
  onBookingSuccess?: (bookingData: any) => void;
}

export function BookingForm({
  apiBaseUrl = "",
  patientId = DEFAULT_PATIENT_ID,
  doctors = DEFAULT_DOCTORS,
  slots = DEFAULT_SLOTS,
  onBookingSuccess,
}: BookingFormProps) {
  // Form State
  const [doctorId, setDoctorId] = useState<string>("");
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(new Date());
  const [slotId, setSlotId] = useState<string>("");

  // Network & UI State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Xóa form về trạng thái ban đầu
  const resetForm = () => {
    setDoctorId("");
    setAppointmentDate(new Date());
    setSlotId("");
    setConflictError(null);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    // Validation cơ bản phía client
    if (!doctorId) {
      toast.warning("Vui lòng chọn bác sĩ khám bệnh.");
      return;
    }
    if (!appointmentDate) {
      toast.warning("Vui lòng chọn ngày khám bệnh.");
      return;
    }
    if (!slotId) {
      toast.warning("Vui lòng chọn khung giờ khám.");
      return;
    }

    // Bắt đầu trạng thái Loading
    setIsLoading(true);

    const payload = {
      patientId,
      doctorId,
      appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
      slotId,
    };

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 1. Xử lý lỗi 409 Conflict: Trùng khung giờ
      if (response.status === 409) {
        const errorMsg = "Khung giờ này vừa có người khác đặt. Vui lòng chọn khung giờ khác!";
        setConflictError(errorMsg);

        // Toast thông báo lỗi trực quan
        toast.error(errorMsg, {
          duration: 5000,
          icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
        });

        // Hủy chọn slot vừa bị conflict để người dùng chọn lại
        setSlotId("");
        return;
      }

      // 2. Xử lý thành công: 200 OK hoặc 201 Created
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        const selectedSlotLabel = slots.find((s) => s.id === slotId)?.label || slotId;

        toast.success("Đặt lịch khám thành công!", {
          description: `Khung giờ: ${selectedSlotLabel} - Ngày: ${format(appointmentDate, "dd/MM/yyyy")}. Mã đặt: ${data.booking_id || "OK"}`,
          duration: 5000,
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        });

        // Reset form theo yêu cầu nghiệp vụ
        resetForm();

        if (onBookingSuccess) {
          onBookingSuccess(data);
        }
        return;
      }

      // 3. Các mã lỗi khác (400, 500,...)
      const errData = await response.json().catch(() => ({}));
      const fallbackMsg = errData.message || "Đặt lịch không thành công. Vui lòng thử lại!";
      toast.error(fallbackMsg);
    } catch (err: any) {
      console.error("[BookingForm Error]:", err);
      toast.error("Không thể kết nối đến máy chủ phòng khám. Vui lòng kiểm tra lại kết nối mạng!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto shadow-md border-border/80 bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-primary">
          <CalendarPlus className="w-6 h-6" /> Đặt Lịch Khám Bệnh
        </CardTitle>
        <CardDescription>
          Hệ thống đặt lịch tự động có cơ chế bảo vệ chống trùng lặp theo thời gian thực.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {/* Fallback Error Alert khi gặp lỗi 409 Conflict */}
          {conflictError && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 animate-in fade-in-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Khung giờ đã có người đặt</AlertTitle>
              <AlertDescription className="text-sm">
                {conflictError}
              </AlertDescription>
            </Alert>
          )}

          {/* 1. Doctor Selection Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="doctor-select" className="text-sm font-semibold flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" /> Chọn Bác sĩ
            </Label>
            <Select
              value={doctorId}
              onValueChange={(val) => {
                setDoctorId(val);
                setConflictError(null);
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="doctor-select" className="w-full h-11 bg-background">
                <SelectValue placeholder="-- Vui lòng chọn Bác sĩ phụ trách --" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id} className="py-2.5">
                    <div className="flex flex-col text-left">
                      <span className="font-medium text-foreground">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{doc.specialty}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Date Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-primary" /> Ngày hẹn khám
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isLoading}
                  className={cn(
                    "w-full h-11 justify-start text-left font-normal bg-background",
                    !appointmentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {appointmentDate ? (
                    format(appointmentDate, "PPP", { locale: vi })
                  ) : (
                    <span>Chọn ngày hẹn...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={appointmentDate}
                  onSelect={(d) => {
                    setAppointmentDate(d);
                    setConflictError(null);
                  }}
                  initialFocus
                  disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 3. Time Slots Grid */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" /> Chọn Khung giờ khám
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {slots.map((s) => {
                const isSelected = slotId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setSlotId(s.id);
                      setConflictError(null);
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "h-11 px-2 text-xs sm:text-sm font-medium rounded-lg border transition-all duration-150 flex items-center justify-center",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                        : "bg-background hover:bg-accent hover:border-primary/50 text-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 flex flex-col sm:flex-row gap-3">
          <Button
            type="submit"
            className="w-full sm:flex-1 h-11 text-base font-semibold transition-all"
            disabled={isLoading || !doctorId || !appointmentDate || !slotId}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang kiểm tra & đặt lịch...
              </>
            ) : (
              "Đặt lịch ngay"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto h-11"
            onClick={resetForm}
            disabled={isLoading}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Làm mới
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default BookingForm;

