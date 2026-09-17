import { NextRequest, NextResponse } from "next/server";
import { DIGITIZE_VISION_PROMPT } from "@/lib/digitizePrompt";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { imageBase64, apiKey, model = "inclusionai/ling-3.0-flash-vl:free" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "请提供试卷照片 (Base64)" },
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

    const payload = {
      model: model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: DIGITIZE_VISION_PROMPT,
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
    };

    const modelReqStart = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com",
        "X-Title": "Gradia Exam Paper Digitizer",
      },
      body: JSON.stringify(payload),
    });

    const modelTimeMs = Date.now() - modelReqStart;

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }
      return NextResponse.json(
        {
          success: false,
          error: errorJson?.error?.message || `模型请求失败 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { success: false, error: "模型未返回有效内容" },
        { status: 500 }
      );
    }

    // Clean up code block fences if present
    let cleanMarkdown = rawContent.trim();
    if (cleanMarkdown.startsWith("```markdown")) {
      cleanMarkdown = cleanMarkdown.replace(/^```markdown\s*/, "").replace(/\s*```$/, "");
    } else if (cleanMarkdown.startsWith("```")) {
      cleanMarkdown = cleanMarkdown.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Extract title
    let title = "电子试卷";
    const titleMatch = cleanMarkdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    const totalTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        markdown: cleanMarkdown,
        title,
        meta: {
          modelTimeMs,
          totalTimeMs,
          modelName: model.includes("ling") ? "Ling-3.0-flash-VL" : model,
        },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `服务器内部错误: ${message}` },
      { status: 500 }
    );
  }
}
