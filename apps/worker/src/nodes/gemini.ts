import type { WorkflowNode, ExecutionContext, NodeResult } from "@nodex/shared";

export interface GeminiNodeInput {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly temperature?: number;
}

export interface GeminiNodeOutput {
  readonly result: string;
  readonly model: string;
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly totalTokenCount?: number;
  };
  readonly finishReason?: string;
  readonly raw?: unknown;
}

export class GeminiNode implements WorkflowNode<
  GeminiNodeInput,
  GeminiNodeOutput
> {
  readonly type = "gemini";

  validate(input: GeminiNodeInput): void {
    if (!input) {
      throw new Error("GeminiNode requires configuration input");
    }
    if (
      !input.prompt ||
      typeof input.prompt !== "string" ||
      !input.prompt.trim()
    ) {
      throw new Error('GeminiNode requires a non-empty "prompt" string');
    }
  }

  async execute(
    input: GeminiNodeInput,
    context: ExecutionContext,
  ): Promise<NodeResult<GeminiNodeOutput>> {
    this.validate(input);

    const model = input.model?.trim() || "gemini-3.6-flash";
    const prompt = input.prompt.trim();
    const systemPrompt = input.systemPrompt?.trim();
    const timeoutMs = input.timeoutMs ?? 30000;

    // Retrieve GEMINI_API_KEY from context.env or process.env
    const envObj = (context.env || {}) as Record<string, string>;
    const apiKey = envObj.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return {
        status: "FAILED",
        error: {
          message:
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or .env file.",
          code: "GEMINI_API_KEY_MISSING",
          retriable: false,
        },
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (context.signal) {
      context.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    // Build Gemini REST API payload
    const requestPayload: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    if (systemPrompt) {
      requestPayload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    if (input.temperature !== undefined) {
      requestPayload.generationConfig = {
        temperature: input.temperature,
      };
    }

    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "NodeX-Workflow-Engine/1.0",
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      const data = (await response.json()) as any;

      if (response.ok) {
        const firstCandidate = data.candidates?.[0];
        const extractedText =
          firstCandidate?.content?.parts
            ?.map((p: any) => p.text || "")
            .join("") || "";

        return {
          status: "SUCCEEDED",
          output: {
            result: extractedText,
            model,
            usageMetadata: data.usageMetadata,
            finishReason: firstCandidate?.finishReason,
            raw: data,
          },
        };
      }

      // Handle non-2xx HTTP responses from Gemini API
      const isRateLimit = response.status === 429;
      const isServerError = response.status >= 500;
      const errorMessage =
        data?.error?.message ||
        `Google Gemini API responded with status ${response.status}: ${response.statusText}`;

      return {
        status: "FAILED",
        error: {
          message: errorMessage,
          code: `GEMINI_${response.status}`,
          retriable: isRateLimit || isServerError,
          details: data,
        },
      };
    } catch (err: any) {
      const isTimeout =
        err.name === "AbortError" || err.message?.includes("aborted");
      return {
        status: "FAILED",
        error: {
          message: isTimeout
            ? `Gemini API request timed out after ${timeoutMs}ms`
            : `Gemini API network error: ${err.message}`,
          code: isTimeout ? "GEMINI_TIMEOUT" : "GEMINI_NETWORK_ERROR",
          retriable: true,
          details: { error: String(err) },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
