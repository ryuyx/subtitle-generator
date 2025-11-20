import { NextRequest } from "next/server";
import { IFlyTekService } from "@/lib/iflytek";
import { generateSRT } from "@/lib/subtitle-utils";
import { addHistory } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;
        const language = (formData.get("language") as string) || "autodialect";

        if (!audioFile) {
          sendEvent({ error: "未上传音频文件", stage: "error" });
          controller.close();
          return;
        }

        // 验证语言参数
        if (language !== "autodialect" && language !== "autominor") {
          sendEvent({ error: "无效的语言参数", stage: "error" });
          controller.close();
          return;
        }

        // 验证文件大小
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (audioFile.size > maxSize) {
          sendEvent({ error: "文件大小超过50MB限制", stage: "error" });
          controller.close();
          return;
        }

        // 读取文件内容
        const bytes = await audioFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 调用讯飞API进行语音识别，带进度回调
        const iflytek = new IFlyTekService();
        
        const segments = await iflytek.transcribe(buffer, language, (progress) => {
          // 实时推送进度
          sendEvent(progress);
        });

        if (!segments || segments.length === 0) {
          sendEvent({ error: "未识别到有效内容", stage: "error" });
          controller.close();
          return;
        }

        // 生成SRT字幕
        const srtContent = generateSRT(segments);

        // 保存历史记录
        const languageLabel = language === "autodialect" 
          ? "中英+方言" 
          : "37语种";
        
        await addHistory({
          fileName: audioFile.name,
          language,
          languageLabel,
          segmentCount: segments.length,
          srtContent,
        });

        // 发送最终结果
        sendEvent({
          stage: "success",
          srtContent,
          segmentCount: segments.length,
          message: "转写成功"
        });

        controller.close();
      } catch (error: any) {
        console.error("转换错误:", error);
        
        // 尝试解析结构化的错误信息
        let errorInfo: any = {
          stage: "error",
          error: error.message || "转换失败，请重试"
        };
        
        try {
          const parsedError = JSON.parse(error.message);
          if (parsedError.orderId) {
            errorInfo = {
              stage: "error",
              error: "转写失败",
              orderId: parsedError.orderId,
              failType: parsedError.failType,
              status: parsedError.status,
              timestamp: parsedError.timestamp,
              originalDuration: parsedError.originalDuration,
              attempts: parsedError.attempts
            };
          }
        } catch (e) {
          // 不是JSON格式，使用原始错误信息
        }
        
        sendEvent(errorInfo);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
