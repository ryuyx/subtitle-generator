import CryptoJS from "crypto-js";
import FormData from "form-data";
import axios from "axios";
import { parseBuffer } from "music-metadata";

interface IFlyTekConfig {
  appId: string;
  apiSecret: string;
  apiKey: string;
}

interface TranscriptionSegment {
  bg: number; // 开始时间（毫秒）
  ed: number; // 结束时间（毫秒）
  text: string; // 文本内容
}

interface UploadResponse {
  code: string;
  descInfo: string;
  content: {
    orderId: string;
    taskEstimateTime: number;
  };
}

interface QueryResponse {
  code: string;
  descInfo: string;
  content: {
    orderInfo: {
      status: number; // 0-已创建 3-处理中 4-已完成 -1-失败
      failType: number;
      orderId: string;
      originalDuration: number;
    };
    orderResult?: string; // 转写结果JSON字符串
    taskEstimateTime?: number;
  };
}

export class IFlyTekService {
  private config: IFlyTekConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      appId: process.env.IFLYTEK_APP_ID || "",
      apiSecret: process.env.IFLYTEK_API_SECRET || "",
      apiKey: process.env.IFLYTEK_API_KEY || "",
    };

    if (!this.config.appId || !this.config.apiSecret || !this.config.apiKey) {
      throw new Error("讯飞API凭证未配置");
    }

    this.baseUrl = "https://office-api-ist-dx.iflyaisol.com";
  }

  /**
   * 生成16位随机字符串
   */
  private generateRandomString(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成ISO8601时间格式 yyyy-MM-dd'T'HH:mm:ss+0800
   * 使用UTC时间转换为北京时间(UTC+8)
   */
  private generateDateTime(): string {
    const now = new Date();
    // 转换为北京时间(UTC+8)
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+0800`;
  }

  /**
   * 生成签名（V2 API签名算法）
   * 参数排序 -> URL编码 -> 构建baseString -> HMAC-SHA1 -> Base64
   */
  private generateSignature(params: Record<string, string>): string {
    // 1. 排除signature字段，过滤空值，按key自然排序
    const sortedKeys = Object.keys(params)
      .filter(key => key !== 'signature' && params[key] != null && params[key] !== '')
      .sort();

    // 2. 构建baseString: key=encodedValue&key=encodedValue...
    const baseString = sortedKeys
      .map(key => {
        const value = params[key];
        const encodedValue = encodeURIComponent(value);
        return `${key}=${encodedValue}`;
      })
      .join('&');

    console.log('签名baseString:', baseString);

    // 3. 使用HMAC-SHA1加密(密钥为apiSecret)并Base64编码
    const hmac = CryptoJS.HmacSHA1(baseString, this.config.apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(hmac);

    return signature;
  }

  /**
   * 上传音频文件（V2 API）
   */
  private async uploadAudio(
    audioBuffer: Buffer,
    language: string,
    signatureRandom?: string
  ): Promise<string> {
    const dateTime = this.generateDateTime();
    if (!signatureRandom) {
      signatureRandom = this.generateRandomString();
    }
    
    // 获取音频真实时长
    let duration = 0;
    try {
      const metadata = await parseBuffer(audioBuffer);
      if (metadata.format.duration) {
        // 转换为毫秒
        duration = Math.ceil(metadata.format.duration * 1000);
        console.log(`音频真实时长: ${duration}ms (${metadata.format.duration.toFixed(2)}秒)`);
      }
    } catch (error) {
      console.warn("无法解析音频时长，使用估算值:", error);
      // 如果解析失败，使用估算值
      duration = Math.ceil((audioBuffer.length * 8) / 128000 * 1000);
    }
    
    // 构建URL参数（用于签名）
    const params: Record<string, string> = {
      appId: this.config.appId,
      accessKeyId: this.config.apiKey,
      dateTime: dateTime,
      signatureRandom: signatureRandom,
      fileSize: audioBuffer.length.toString(),
      fileName: "audio.mp3",
      duration: duration.toString(),
      language: language, // 使用传入的language参数（autodialect 或 autominor）
    };

    // 生成签名
    const signature = this.generateSignature(params);

    // 构建URL查询参数
    const queryParams = new URLSearchParams({
      ...params,
    });

    const uploadUrl = `${this.baseUrl}/v2/upload?${queryParams.toString()}`;

    try {
      console.log("准备上传音频:", {
        appId: this.config.appId,
        dateTime: dateTime,
        signatureRandom: signatureRandom,
        fileSize: audioBuffer.length,
        language: params.language,
        uploadUrl: uploadUrl.split('?')[0], // 只显示基础URL
      });

      const response = await axios.post<UploadResponse>(
        uploadUrl,
        audioBuffer,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'signature': signature,
          },
          timeout: 60000,
        }
      );

      console.log("上传响应:", response.data);

      if (response.data.code !== "000000") {
        // 记录签名超时等错误的详细信息
        console.error("上传失败详情:", {
          code: response.data.code,
          descInfo: response.data.descInfo,
          dateTime: dateTime,
          serverTime: new Date().toISOString(),
        });
        throw new Error(`上传失败: ${response.data.descInfo}`);
      }

      return response.data.content.orderId;
    } catch (error: any) {
      if (error.response) {
        console.error("API错误响应:", error.response.data);
        throw new Error(`上传音频失败: ${error.response.data?.descInfo || error.message}`);
      }
      throw new Error(`上传音频失败: ${error.message}`);
    }
  }

  /**
   * 查询转写结果（V2 API）
   */
  private async queryResult(orderId: string, signatureRandom: string): Promise<string> {
    const dateTime = this.generateDateTime();
    
    // 构建URL参数（用于签名）
    // resultType只请求转写结果，如果账号未开通质检能力会导致failType 11错误
    const params: Record<string, string> = {
      accessKeyId: this.config.apiKey,
      dateTime: dateTime,
      signatureRandom: signatureRandom,
      orderId: orderId,
      resultType: "transfer",
    };

    // 生成签名
    const signature = this.generateSignature(params);

    // 构建URL查询参数
    const queryParams = new URLSearchParams(params);
    const queryUrl = `${this.baseUrl}/v2/getResult?${queryParams.toString()}`;

    try {
      const response = await axios.post<QueryResponse>(
        queryUrl,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'signature': signature,
          },
          timeout: 30000,
        }
      );

      if (response.data.code !== "000000") {
        throw new Error(`查询失败: ${response.data.descInfo}`);
      }

      const status = response.data.content.orderInfo.status;

      // status: 0-已创建 3-处理中 4-已完成 -1-失败
      if (status === -1) {
        const failType = response.data.content.orderInfo.failType;
        const failInfo = {
          orderId: orderId,
          status: status,
          failType: failType,
          originalDuration: response.data.content.orderInfo.originalDuration,
          timestamp: new Date().toISOString(),
        };
        console.error("转写失败详情:", JSON.stringify(failInfo, null, 2));
        throw new Error(JSON.stringify(failInfo));
      }

      if (status === 4 && response.data.content.orderResult) {
        return response.data.content.orderResult;
      }

      return ""; // 未完成
    } catch (error: any) {
      if (error.response) {
        console.error("查询错误响应:", error.response.data);
      }
      throw new Error(`查询结果失败: ${error.message}`);
    }
  }

  /**
   * 解析转写结果（V2 API格式）
   */
  private parseResult(resultJson: string): TranscriptionSegment[] {
    try {
      const result = JSON.parse(resultJson);
      const segments: TranscriptionSegment[] = [];

      if (result.lattice && Array.isArray(result.lattice)) {
        result.lattice.forEach((item: any) => {
          try {
            const jsonData = JSON.parse(item.json_1best);
            
            if (jsonData.st && jsonData.st.rt) {
              const bg = parseInt(jsonData.st.bg) || 0;
              const ed = parseInt(jsonData.st.ed) || 0;
              
              jsonData.st.rt.forEach((rt: any) => {
                if (rt.ws && Array.isArray(rt.ws)) {
                  const words = rt.ws
                    .map((ws: any) => {
                      if (ws.cw && Array.isArray(ws.cw) && ws.cw.length > 0) {
                        return ws.cw[0].w || "";
                      }
                      return "";
                    })
                    .filter((w: string) => w.trim())
                    .join("");

                  if (words.trim()) {
                    segments.push({
                      bg: bg,
                      ed: ed,
                      text: words.trim(),
                    });
                  }
                }
              });
            }
          } catch (e) {
            console.error("解析单个片段失败:", e);
          }
        });
      }

      return segments;
    } catch (error) {
      console.error("解析转写结果失败:", error, "原始数据:", resultJson.substring(0, 200));
      throw new Error("解析转写结果失败");
    }
  }


  /**
   * 转换音频为字幕
   */
  async transcribe(
    audioBuffer: Buffer,
    language: string = "autodialect",
    onProgress?: (progress: {
      stage: string;
      orderId?: string;
      attempts?: number;
      maxAttempts?: number;
      message: string;
    }) => void
  ): Promise<TranscriptionSegment[]> {
    try {
      // 生成随机串（上传和查询需使用同一个）
      const signatureRandom = this.generateRandomString();

      // 1. 上传音频文件（传入由外部生成的 signatureRandom）
      onProgress?.({
        stage: "uploading",
        message: "正在上传音频文件..."
      });
      
      const orderId = await this.uploadAudio(audioBuffer, language, signatureRandom);
      console.log(`音频上传成功，订单ID: ${orderId}`);
      
      onProgress?.({
        stage: "uploaded",
        orderId,
        message: `上传成功，订单ID: ${orderId}`
      });

      // 2. 轮询查询结果（最多等待5分钟）
      const maxAttempts = 60; // 60次，每次5秒
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒

        attempts++;
        
        onProgress?.({
          stage: "processing",
          orderId,
          attempts,
          maxAttempts,
          message: `正在转写中... (${attempts}/${maxAttempts})`
        });

        try {
          const resultJson = await this.queryResult(orderId, signatureRandom);

          if (resultJson) {
            // 3. 解析结果
            onProgress?.({
              stage: "parsing",
              orderId,
              message: "正在解析转写结果..."
            });
            
            const segments = this.parseResult(resultJson);
            console.log(`转写完成，共 ${segments.length} 段文本`);
            
            onProgress?.({
              stage: "completed",
              orderId,
              message: `转写完成，共 ${segments.length} 段文本`
            });
            
            return segments;
          }
        } catch (queryError: any) {
          // 如果是转写失败（status === -1），记录详细信息后抛出
          console.error(`订单 ${orderId} 查询异常:`, queryError.message);
          
          // 尝试解析失败信息
          try {
            const failInfo = JSON.parse(queryError.message);
            if (failInfo.status === -1) {
              // 这是一个已知的转写失败，保留完整信息
              onProgress?.({
                stage: "failed",
                orderId,
                message: `转写失败: failType ${failInfo.failType}`
              });
              throw queryError;
            }
          } catch (parseError) {
            // 不是JSON格式的错误，继续轮询
          }
          
          // 其他查询错误，继续轮询
        }

        console.log(`正在转写中... (${attempts}/${maxAttempts})`);
      }

      // 超时失败也要记录
      const timeoutInfo = {
        orderId: orderId,
        status: "timeout",
        attempts: maxAttempts,
        timestamp: new Date().toISOString(),
      };
      console.error("转写超时详情:", JSON.stringify(timeoutInfo, null, 2));
      
      onProgress?.({
        stage: "failed",
        orderId,
        attempts: maxAttempts,
        message: "转写超时"
      });
      
      throw new Error(JSON.stringify(timeoutInfo));
    } catch (error: any) {
      // 保留原始错误信息，不再简化
      console.error("转写流程异常:", error.message);
      throw error;
    }
  }
}
