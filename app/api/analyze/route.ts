import { NextRequest, NextResponse } from "next/server";
import { HOMEWORK_VISION_PROMPT } from "@/lib/prompt";
import { HomeworkAnalysisResult } from "@/types/homework";

export const maxDuration = 60; // Support Vercel extended serverless timeout

async function callOpenRouter(
  model: string,
  formattedImageUrl: string,
  apiKey: string
) {
  const payload = {
    model: model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: HOMEWORK_VISION_PROMPT,
          },
          {
            type: "image_url",
            image_url: {
              url: formattedImageUrl,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    // Note: Do NOT include response_format: { type: "json_object" }
    // because third-party providers on OpenRouter (vLLM/Baseten) do not support it
    // and will crash with "Provider returned error".
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vercel.com",
      "X-Title": "Homework Corrector Ling 3.0",
    },
    body: JSON.stringify(payload),
  });

  return response;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { imageBase64, apiKey, model = "inclusionai/ling-3.0-flash-vl:free" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "请提供作业图片数据 (Base64)" },
        { status: 400 }
      );
    }

    const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY;
    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "未配置 OpenRouter API Key。请在页面右上角设置中输入您的 OpenRouter 密钥，或在 Vercel 环境变量中设置 OPENROUTER_API_KEY。",
          needKey: true,
        },
        { status: 401 }
      );
    }

    let formattedImageUrl = imageBase64;
    if (!imageBase64.startsWith("data:")) {
      formattedImageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    const modelReqStart = Date.now();
    let response = await callOpenRouter(model, formattedImageUrl, resolvedApiKey);
    let activeModel = model;

    // If primary model failed with provider error/overload, try robust fallback free models
    if (!response.ok && model.includes("ling")) {
      console.warn(
        `Primary model ${model} failed with ${response.status}. Attempting fallback to Qwen 2.5 VL...`
      );
      const fallbackModel = "qwen/qwen-2.5-vl-72b-instruct:free";
      const fallbackResponse = await callOpenRouter(
        fallbackModel,
        formattedImageUrl,
        resolvedApiKey
      );
      if (fallbackResponse.ok) {
        response = fallbackResponse;
        activeModel = fallbackModel;
      }
    }

    const modelTimeMs = Date.now() - modelReqStart;

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }

      const rawMsg = errorJson?.error?.message || errorText;
      let friendlyMsg = rawMsg;
      if (rawMsg.includes("Provider returned error")) {
        friendlyMsg =
          "上游模型节点暂时繁忙或无响应 (Provider returned error)。建议在右上角 ⚙️ 设置中切换模型 (如 Qwen 2.5 VL 或 Gemini 2.0 Flash) 后重试。";
      }

      return NextResponse.json(
        {
          success: false,
          error: friendlyMsg,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "模型未返回有效内容" },
        { status: 500 }
      );
    }

    // Robust JSON extraction
    let cleanJson = content.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const firstBrace = cleanJson.indexOf("{");
    const lastBrace = cleanJson.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
    }

    let parsedResult: HomeworkAnalysisResult;
    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (parseErr) {
      return NextResponse.json(
        {
          success: false,
          error: `解析模型 JSON 输出失败: ${(parseErr as Error).message}。原始内容片段: ${cleanJson.slice(0, 200)}`,
        },
        { status: 500 }
      );
    }

    const totalTimeMs = Date.now() - startTime;
    parsedResult.meta = {
      modelTimeMs,
      totalTimeMs,
      modelName: activeModel.includes("ling")
        ? "Ling-3.0-flash-VL"
        : activeModel.split("/").pop() || activeModel,
    };

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `服务器内部错误: ${message}` },
      { status: 500 }
    );
  }
}
