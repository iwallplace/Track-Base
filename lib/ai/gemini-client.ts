import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("⚠️ GEMINI_API_KEY is missing in environment variables!");
}

// Singleton instance to avoid multiple clients
let genAIInstance: GoogleGenerativeAI | null = null;

export const getGeminiClient = () => {
    // Always check for key at runtime in case env is loaded late
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(key);
    }
    return genAIInstance;
};

// Optimized Model Config for Free Tier
export const GEMINI_MODEL_CONFIG = {
    model: "gemini-flash-latest", // Updated to match working summary endpoint
    generationConfig: {
        maxOutputTokens: 1000, // Limit output to save quota
        temperature: 0.7,
    },
    // Safety settings to prevent blocking useful content but keeping it safe
    safetySettings: [],
};

/**
 * Helper to handle API errors gracefully for Free Tier
 */
export const handleGeminiError = (error: unknown) => {
    console.error("Gemini API Error:", error);

    const errStr = String(error);
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota")) {
        return {
            error: true,
            code: "QUOTA_EXCEEDED",
            message: "Günlük AI limitine ulaşıldı. Lütfen daha sonra tekrar deneyin."
        };
    }

    return {
        error: true,
        code: "INTERNAL_ERROR",
        message: "AI Hatası: " + (error instanceof Error ? error.message : String(error))
    };
};
