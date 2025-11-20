import { NextRequest, NextResponse } from "next/server";
import { IFlyTekService } from "@/lib/iflytek";
import { generateSRT } from "@/lib/subtitle-utils";
import { addHistory } from "@/lib/history";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const language = (formData.get("language") as string) || "autodialect";

    if (!audioFile) {
      return NextResponse.json(
        { error: "未上传音频文件" },
        { status: 400 }
      );
    }

    // 验证语言参数
    if (language !== "autodialect" && language !== "autominor") {
      return NextResponse.json(
        { error: "无效的语言参数" },
        { status: 400 }
      );
    }

    // 验证文件大小
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小超过50MB限制" },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 调用讯飞API进行语音识别（直接使用 Buffer，不保存临时文件）
    const iflytek = new IFlyTekService();
    const segments = await iflytek.transcribe(buffer, language);

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "未识别到有效内容" },
        { status: 400 }
      );
    }

    // 生成SRT字幕
    const srtContent = generateSRT(segments);

    // 保存历史记录到 Supabase
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

    return NextResponse.json({
      success: true,
      srtContent,
      segmentCount: segments.length,
    });
  } catch (error: any) {
    console.error("转换错误:", error);
    
    // 尝试解析结构化的错误信息
    let errorInfo: any = {
      error: error.message || "转换失败，请重试"
    };
    
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError.orderId) {
        // 这是一个结构化的失败信息
        errorInfo = {
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
    
    if (process.env.NODE_ENV === "development") {
      errorInfo.details = error.stack;
    }
    
    return NextResponse.json(errorInfo, { status: 500 });
  }
}
