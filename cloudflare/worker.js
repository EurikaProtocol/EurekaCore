import { handleApi } from "../src/server/api";

export default {
  async fetch(request, env) {
    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    const pathname = new URL(request.url).pathname;

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (request.method === "GET" && response.ok) {
      if (
        pathname === "/" ||
        pathname.endsWith(".html") ||
        headers.get("Content-Type")?.startsWith("text/html")
      ) {
        headers.set("Cache-Control", "no-cache");
      } else if (/^\/assets\/.+-[\w-]{8,}\.[^/]+$/.test(pathname)) {
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
