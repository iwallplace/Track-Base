import { z } from 'zod';

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
    username: z.string().min(1, "Kullanıcı adı gerekli"),
    password: z.string().min(1, "Şifre gerekli")
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Geçerli bir email adresi giriniz")
});

export const resetPasswordSchema = z.object({
    email: z.string().email("Geçerli bir email adresi giriniz"),
    code: z.string().length(6, "Kod 6 karakter olmalı"),
    newPassword: z.string().min(6, "Şifre en az 6 karakter olmalı")
});

// ==================== USER SCHEMAS ====================

export const createUserSchema = z.object({
    name: z.string().min(2, "İsim en az 2 karakter olmalı"),
    username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalı"),
    password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
    role: z.enum(['ADMIN', 'USER', 'IME', 'KALITE'])
});

export const updateUserSchema = z.object({
    id: z.string().uuid("Geçersiz ID formatı"),
    name: z.string().min(2).optional(),
    username: z.string().min(3).optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['ADMIN', 'USER', 'IME', 'KALITE']).optional()
});

// ==================== INVENTORY SCHEMAS ====================

export const createInventoryItemSchema = z.object({
    year: z.union([z.string(), z.number()]).transform(v => Number(v)).optional(),
    month: z.union([z.string(), z.number()]).transform(v => Number(v)).optional(),
    week: z.union([z.string(), z.number()]).transform(v => Number(v)).optional(),
    date: z.string().optional(),
    company: z.string().optional(),
    waybillNo: z.string().min(1, "İrsaliye numarası gerekli"),
    materialReference: z.string().min(1, "Malzeme referansı gerekli"),
    stockCount: z.union([z.string(), z.number()])
        .transform(v => Number(v))
        .refine(v => Number.isInteger(v), { message: "Stok adedi tam sayı olmalıdır" })
        .refine(v => v > 0, { message: "Stok adedi 0'dan büyük olmalıdır" }),
    lastAction: z.enum(['Giriş', 'Çıkış']).default('Giriş'),
    note: z.string().optional()
});

// ==================== PROFILE SCHEMAS ====================

export const updateProfileSchema = z.object({
    name: z.string().min(2).optional().or(z.literal('')),
    username: z.string().min(3).optional().or(z.literal('')),
    currentPassword: z.string().optional().or(z.literal('')),
    newPassword: z.string().min(6).optional().or(z.literal('')),
    image: z.string().optional()
}).refine(data => {
    // If newPassword is provided (and not empty), currentPassword must also be provided
    if (data.newPassword && data.newPassword.length > 0 && !data.currentPassword) {
        return false;
    }
    return true;
}, {
    message: "Yeni şifre için mevcut şifre gerekli",
    path: ["currentPassword"]
});

// ==================== AI CHAT SCHEMA ====================

export const chatMessageSchema = z.object({
    message: z.string().min(1, "Mesaj boş olamaz").max(1000, "Mesaj çok uzun"),
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        parts: z.array(z.object({
            text: z.string()
        }))
    })).optional()
});

// ==================== HELPERS ====================

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = result.error.issues.map(e => e.message).join(', ');
    return { success: false, error: errorMessage };
}
