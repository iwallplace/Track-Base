import { NextResponse } from 'next/server';

type ApiResponseData = Record<string, unknown> | unknown[];

interface SuccessResponse {
    success: true;
    data?: ApiResponseData;
    message?: string;
}

interface ErrorResponse {
    success: false;
    error: string;
    code?: string;
}

export function successResponse(data?: ApiResponseData, message?: string, status = 200) {
    const response: SuccessResponse = { success: true };
    if (data !== undefined) response.data = data;
    if (message) response.message = message;
    return NextResponse.json(response, { status });
}

export function errorResponse(error: string, status = 400, code?: string) {
    const response: ErrorResponse = { success: false, error };
    if (code) response.code = code;
    return NextResponse.json(response, { status });
}

export function unauthorizedResponse(message = "Unauthorized") {
    return errorResponse(message, 401, "UNAUTHORIZED");
}

export function forbiddenResponse(message = "Forbidden") {
    return errorResponse(message, 403, "FORBIDDEN");
}

export function notFoundResponse(message = "Not Found") {
    return errorResponse(message, 404, "NOT_FOUND");
}

export function validationErrorResponse(message: string) {
    return errorResponse(message, 400, "VALIDATION_ERROR");
}

export function internalErrorResponse(message = "Internal Server Error") {
    return errorResponse(message, 500, "INTERNAL_ERROR");
}

// Conditional logging helper
export function devLog(...args: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(...args);
    }
}

export function devError(...args: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
        console.error(...args);
    }
}
