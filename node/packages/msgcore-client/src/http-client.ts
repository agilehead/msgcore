import type { Logger, Result } from "./types.js";
import { success, failure } from "./types.js";

export async function graphqlRequest<T>(options: {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  token: string;
  timeout?: number;
  logger?: Logger;
}): Promise<Result<T>> {
  const { endpoint, query, variables, token, timeout, logger } = options;

  try {
    logger?.debug("MsgCore GraphQL request:", { endpoint });

    const controller = new AbortController();
    const timeoutId =
      timeout !== undefined
        ? setTimeout(() => controller.abort(), timeout)
        : undefined;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      const message = `MsgCore API error: ${String(response.status)}`;
      logger?.error("MsgCore request failed:", {
        status: response.status,
        error: message,
      });
      return failure(new Error(message));
    }

    const json = (await response.json()) as {
      data?: T;
      errors?: { message: string }[];
    };

    if (json.errors && json.errors.length > 0) {
      const message = json.errors.map((e) => e.message).join("; ");
      logger?.error("MsgCore GraphQL error:", { errors: json.errors });
      return failure(new Error(message));
    }

    if (json.data === undefined || json.data === null) {
      return failure(new Error("No data in MsgCore response"));
    }

    return success(json.data);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      logger?.error("MsgCore request timed out:", { endpoint });
      return failure(new Error("Request timed out"));
    }
    const message = err instanceof Error ? err.message : String(err);
    logger?.error("MsgCore request error:", { endpoint, error: message });
    return failure(new Error(`Network error: ${message}`));
  }
}

export async function internalRequest<T>(options: {
  endpoint: string;
  method: string;
  path: string;
  secret: string;
  body?: unknown;
  timeout?: number;
  logger?: Logger;
}): Promise<Result<T>> {
  const { endpoint, method, path, secret, body, timeout, logger } = options;
  const url = `${endpoint}${path}`;

  try {
    logger?.debug("MsgCore internal request:", { method, url });

    const controller = new AbortController();
    const timeoutId =
      timeout !== undefined
        ? setTimeout(() => controller.abort(), timeout)
        : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      const message = `MsgCore API error: ${String(response.status)}`;
      logger?.error("MsgCore internal request failed:", {
        status: response.status,
        path,
        error: message,
      });
      return failure(new Error(message));
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const json = (await response.json()) as T;
      return success(json);
    }

    return success(undefined as T);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      logger?.error("MsgCore internal request timed out:", { url });
      return failure(new Error("Request timed out"));
    }
    const message = err instanceof Error ? err.message : String(err);
    logger?.error("MsgCore internal request error:", {
      url,
      error: message,
    });
    return failure(new Error(`Network error: ${message}`));
  }
}
