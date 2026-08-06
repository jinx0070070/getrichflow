// RICHFLOW 시세 중계 서버 (Cloudflare Worker)
// (1) 야후/나스닥/네이버 등을 브라우저에서 부를 수 있게 CORS 프록시 (?url=)
// (2) Finnhub 전용 캐싱 프록시 (?fh=) — 키를 워커 Secret(FINNHUB_KEY)에서 주입, 1시간 캐시.
//     → 방문자가 아무리 많아도 Finnhub 호출은 종목당 시간당 1회 → 무료 한도 안전, 키도 숨김.
// 무료(하루 10만 요청), 안 막힘, 빠름.
//
// ▶ 배포 전 준비: Cloudflare 대시보드 → Workers → 이 워커 → Settings → Variables →
//   "FINNHUB_KEY" 이름으로 Secret 추가(값 = Finnhub API 키) 후 Deploy.

export default {
  async fetch(request, env) {
    // CORS 사전요청(OPTIONS) 응답
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    const url = new URL(request.url);

    // ===== (2) Finnhub 캐싱 프록시 =====
    const fh = url.searchParams.get("fh");
    if (fh) {
      // 허용 엔드포인트만 (오픈 프록시 방지)
      const FH_PATHS = {
        insider: "stock/insider-transactions",
        inst: "stock/institutional-ownership",
        fund: "stock/fund-ownership",
        quote: "quote",
      };
      const path = FH_PATHS[fh];
      if (!path) return new Response("fh endpoint not allowed", { status: 403, headers: cors() });

      const key = env && env.FINNHUB_KEY;
      if (!key) return new Response("FINNHUB_KEY not set on worker", { status: 500, headers: cors() });

      const sym = (url.searchParams.get("symbol") || "").replace(/[^A-Za-z0-9.\-]/g, "");
      let fu = "https://finnhub.io/api/v1/" + path + "?symbol=" + encodeURIComponent(sym) + "&token=" + key;
      const from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (from) fu += "&from=" + encodeURIComponent(from.replace(/[^0-9\-]/g, ""));
      if (to) fu += "&to=" + encodeURIComponent(to.replace(/[^0-9\-]/g, ""));

      try {
        const r = await fetch(fu, {
          headers: { "Accept": "application/json" },
          cf: { cacheTtl: 3600, cacheEverything: true }, // 1시간 엣지 캐시
        });
        const body = await r.text();
        return new Response(body, {
          status: r.status,
          headers: {
            ...cors(),
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
            "X-Richflow-Cache": "finnhub-1h",
          },
        });
      } catch (e) {
        return new Response("finnhub error: " + e.message, { status: 502, headers: cors() });
      }
    }

    // ===== (1) 일반 CORS 프록시 (?url=) =====
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("missing ?url= or ?fh=", { status: 400, headers: cors() });
    }

    let host;
    try { host = new URL(target).hostname; }
    catch (e) { return new Response("bad url", { status: 400, headers: cors() }); }

    const allowed = [
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
      "api.nasdaq.com",
      "m.stock.naver.com",
      "api.stock.naver.com",
      "ac.stock.naver.com",
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
