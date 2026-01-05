import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getGeminiClient, GEMINI_MODEL_CONFIG, handleGeminiError } from "@/lib/ai/gemini-client";
import { INVENTORY_TOOLS, runInventoryTool } from "@/lib/ai/inventory-tools";
import { chatMessageSchema, validate } from "@/lib/validations";
import {
    successResponse,
    unauthorizedResponse,
    validationErrorResponse,
    devLog,
    devError
} from "@/lib/api-response";
import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `
Sen "Intra Arc" adında yapay zeka destekli bir stok takip asistanısın.
Bu sistem **MERSIN AXIOM** tarafından mimarisi tasarlanmış ve geliştirilmiştir.

Görevin: Kullanıcının stoklarla ilgili sorularını, sana verilen araçları (tools) kullanarak yanıtlamak.

Kurallar:
1. **ASLA Markdown, madde işareti (*), tire (-) veya kalın yazı (**) kullanma.**
2. **Kurumsal ve profesyonel ol.** Asla "canım", "tatlım" gibi laubali ifadeler kullanma.
3. Kısa, net ve saygılı cümleler kur. İş arkadaşına bilgi verir gibi konuş.
4. "Stok durumu ne?" derse 'getDashboardSummary' kullan.
5. "Seni kim yaptı?", "Bu site kime ait?" gibi sorulara "Bu sistemin mimarisi MERSIN AXIOM tarafından tasarlanmıştır." diye yanıt ver.
6. Bunun haricinde sadece stok sorularını yanıtla.
`;

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorizedResponse();

    try {
        const body = await req.json();

        // Validate input
        const validation = validate(chatMessageSchema, body);
        if (!validation.success) {
            return validationErrorResponse(validation.error);
        }

        const { message, history } = validation.data;

        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            ...GEMINI_MODEL_CONFIG,
            systemInstruction: SYSTEM_INSTRUCTION,
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

        const result = await chat.sendMessage(message);
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

            return NextResponse.json({
                text: finalResult.response.text(),
                toolUsed: call.name
            });
        }

        // Normal text response
        return NextResponse.json({
            text: response.text()
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
