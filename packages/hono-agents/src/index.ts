import type { AgentOptions } from "agents";
import { routeAgentRequest } from "agents";
import type { Context, Env } from "hono";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";

const startTime = Date.now();
const latencyBuckets = [50, 100, 250, 500, 1000, 2000];
const latencyHistogram = latencyBuckets.map(() => 0);
let latencySum = 0;
let totalRequests = 0;

/**
 * Configuration options for the Cloudflare Agents middleware
 */
type AgentMiddlewareContext<E extends Env> = {
  /** Cloudflare Agents-specific configuration options */
  options?: AgentOptions<E>;
  /** Optional error handler for caught errors */
  onError?: (error: Error) => void;
};

/**
 * Creates a middleware for handling Cloudflare Agents WebSocket and HTTP requests
 * Processes both WebSocket upgrades and standard HTTP requests, delegating them to Cloudflare Agents
 */
export function agentsMiddleware<E extends Env = Env>(
  ctx?: AgentMiddlewareContext<E>
) {
  return createMiddleware<Env>(async (c, next) => {
    try {
      const handler = isWebSocketUpgrade(c)
        ? handleWebSocketUpgrade
        : handleHttpRequest;

      const response = await handler(c, ctx?.options);

      return response === null ? await next() : response;
    } catch (error) {
      if (ctx?.onError) {
        ctx.onError(error as Error);
        return next();
      }
      throw error;
    }
  });
}

/**
 * Checks if the incoming request is a WebSocket upgrade request
 * Looks for the 'upgrade' header with a value of 'websocket' (case-insensitive)
 */
function isWebSocketUpgrade(c: Context): boolean {
  return c.req.header("upgrade")?.toLowerCase() === "websocket";
}

/**
 * Handles WebSocket upgrade requests
 * Returns a WebSocket upgrade response if successful, null otherwise
 */
async function handleWebSocketUpgrade<E extends Env>(
  c: Context<E>,
  options?: AgentOptions<E>
) {
  const response = await routeAgentRequest(
    c.req.raw,
    env(c) satisfies Env,
    options
  );

  if (!response?.webSocket) {
    return null;
  }

  return new Response(null, {
    status: 101,
    webSocket: response.webSocket
  });
}

/**
 * Handles standard HTTP requests
 * Forwards the request to Cloudflare Agents and returns the response
 */
async function handleHttpRequest<E extends Env>(
  c: Context<E>,
  options?: AgentOptions<E>
) {
  const url = new URL(c.req.url);

  if (url.pathname === "/healthz") {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    return new Response(JSON.stringify({ uptime: uptimeSeconds }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (url.pathname === "/metrics") {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    let metrics = `uptime_seconds ${uptimeSeconds}\n`;
    let cumulative = 0;
    latencyBuckets.forEach((bucket, i) => {
      cumulative += latencyHistogram[i];
      metrics += `request_latency_bucket{le="${bucket}"} ${cumulative}\n`;
    });
    metrics += `request_latency_bucket{le="+Inf"} ${totalRequests}\n`;
    metrics += `request_latency_sum ${latencySum}\n`;
    metrics += `request_latency_count ${totalRequests}`;
    return new Response(metrics, {
      headers: { "Content-Type": "text/plain" }
    });
  }

  const start = Date.now();
  const response = await routeAgentRequest(
    c.req.raw,
    env(c) satisfies Env,
    options
  );
  const duration = Date.now() - start;
  latencySum += duration;
  totalRequests++;
  for (let i = 0; i < latencyBuckets.length; i++) {
    if (duration <= latencyBuckets[i]) {
      latencyHistogram[i]++;
      break;
    }
  }
  return response;
}
