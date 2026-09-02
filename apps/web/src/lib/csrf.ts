export function isSameOriginRequest(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("x-ditch-request") === "1" &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}
