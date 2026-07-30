// RICHFLOW 시세 중계 서버 (Cloudflare Worker)
// 야후 파이낸스 / 나스닥 API를 브라우저에서 부를 수 있게 CORS를 열어주는 프록시.
// 무료(하루 10만 요청), 안 막힘, 빠름.

export default {
  async fetch(request) {
    // CORS 사전요청(OPTIONS) 응답
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("missing ?url=", { status: 400, headers: cors() });
    }

    // 허용 도메인만 (보안 — 아무 사이트나 프록시 안 되게)
    let host;
    try { host = new URL(target).hostname; }
    catch (e) { return new Response("bad url", { status: 400, headers: cors() }); }

    const allowed = [
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
      "api.nasdaq.com",
    ];
    if (!allowed.includes(host)) {
      return new Response("host not allowed", { status: 403, headers: cors() });
    }

    try {
      const r = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json,text/plain,*/*",
        },
        cf: { cacheTtl: 5, cacheEverything: true },
      });
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: {
          ...cors(),
          "Content-Type": r.headers.get("Content-Type") || "application/json",
        },
      });
    } catch (e) {
      return new Response("upstream error: " + e.message, { status: 502, headers: cors() });
    }
  },
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}
