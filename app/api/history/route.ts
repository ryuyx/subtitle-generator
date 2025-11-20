import { NextRequest, NextResponse } from "next/server";
import { getHistory, deleteHistory, clearHistory } from "@/lib/history";

/**
 * GET /api/history - 获取历史记录列表
 */
export async function GET() {
  try {
    const history = await getHistory();
    
    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    console.error("获取历史记录失败:", error);
    
    return NextResponse.json(
      { error: error.message || "获取历史记录失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history?id=xxx - 删除指定历史记录
 * DELETE /api/history?all=true - 清空所有历史记录
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    if (all === "true") {
      await clearHistory();
      return NextResponse.json({
        success: true,
        message: "已清空所有历史记录",
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: "缺少参数 id" },
        { status: 400 }
      );
    }

    await deleteHistory(id);
    
    return NextResponse.json({
      success: true,
      message: "删除成功",
    });
  } catch (error: any) {
    console.error("删除历史记录失败:", error);
    
    return NextResponse.json(
      { error: error.message || "删除失败" },
      { status: 500 }
    );
  }
}
