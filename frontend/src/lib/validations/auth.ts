import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Vui lòng nhập email" })
    .email({ message: "Địa chỉ email không đúng định dạng (ví dụ: doctor@clinic.vn)" }),
  password: z
    .string()
    .min(1, { message: "Vui lòng nhập mật khẩu" })
    .min(6, { message: "Mật khẩu phải có độ dài tối thiểu 6 ký tự" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

