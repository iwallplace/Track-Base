import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getGeminiClient, GEMINI_MODEL_CONFIG, handleGeminiError } from "@/lib/ai/gemini-client";
import { INVENTORY_TOOLS, runInventoryTool } from "@/lib/ai/inventory-tools";
import { sanitizeUserMessage, validateAIResponse, DEFENSIVE_SYSTEM_INSTRUCTION } from "@/lib/ai/prompt-guard";
import { chatMessageSchema, validate } from "@/lib/validations";
import { hasPermission } from "@/lib/permissions";
import {
    unauthorizedResponse,
    forbiddenResponse,
    validationErrorResponse,
    errorResponse,
    devLog,
    devError
} from "@/lib/api-response";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    // RBAC: ai.use izin kontrolü
    const canUseAI = await hasPermission(session.user.role || "USER", 'ai.use');
    if (!canUseAI) {
        return forbiddenResponse("AI asistanını kullanma yetkiniz bulunmamaktadır");
    }

    try {
        const body = await req.json();

        // Validate input
        const validation = validate(chatMessageSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { message, history } = validation.data;

        // =====================
        // PROMPT INJECTION GUARD
        // =====================
        const sanitizationResult = sanitizeUserMessage(message);
        if (!sanitizationResult.safe) {
            console.warn(`[SECURITY] Prompt injection attempt blocked from user: ${session.user.id}`);
            return errorResponse(
                sanitizationResult.reason || "Güvenlik politikasına aykırı içerik tespit edildi",
                400,
                "PROMPT_INJECTION_BLOCKED"
            );
        }

        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            ...GEMINI_MODEL_CONFIG,
            systemInstruction: DEFENSIVE_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: Object.values(INVENTORY_TOOLS) }] as unknown as undefined
        });

        // Sanitize history: The first message must be from 'user'
        let validHistory = history || [];

        // Remove strictly leading model messages until we find a user message
        while (validHistory.length > 0 && validHistory[0].role !== 'user') {
            validHistory.shift();
        }

        // Start chat with sanitized history
        const chat = model.startChat({
            history: validHistory,
        });

        const result = await chat.sendMessage(sanitizationResult.sanitized);
        const response = result.response;

        // Handle Function Calls
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            // Execute the first tool call
            const call = functionCalls[0];
            devLog(`🛠️ Tool called: ${call.name}`);
            const toolResult = await runInventoryTool(call.name, call.args);

            // Send tool result back to model to generate final answer
            const finalResult = await chat.sendMessage([{
                functionResponse: {
                    name: call.name,
                    response: { result: toolResult }
                }
            }]);

            // Validate AI response for sensitive data
            const responseText = finalResult.response.text();
            const validatedResponse = validateAIResponse(responseText);

            return NextResponse.json({
                text: validatedResponse.filtered,
                toolUsed: call.name
            });
        }

        // Normal text response - validate before returning
        const responseText = response.text();
        const validatedResponse = validateAIResponse(responseText);

        return NextResponse.json({
            text: validatedResponse.filtered
        });

    } catch (error) {
        devError("AI-Chat-Error:", error);
        // Explicitly check if it's a key authentication error
        if (String(error).includes("API_KEY_INVALID")) {
            return NextResponse.json({
                error: "API Key Hatası",
                message: "Sistemde Gemini API anahtarı tanımlı değil veya hatalı."
            }, { status: 500 });
        }
        return NextResponse.json(handleGeminiError(error), { status: 500 });
    }
}
