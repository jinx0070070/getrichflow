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
    if (request.method !== "GET") {
      return new Response("method not allowed", { status: 405, headers: { ...cors(), Allow: "GET, OPTIONS" } });
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
      if (!sym) return new Response("symbol required", { status: 400, headers: cors() });
      let fu = "https://finnhub.io/api/v1/" + path + "?symbol=" + encodeURIComponent(sym) + "&token=" + key;
      const from = url.searchParams.get("from"), to = url.searchParams.get("to");
      const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
      const safeFrom = isoDate(from), safeTo = isoDate(to);
      if (safeFrom) fu += "&from=" + encodeURIComponent(safeFrom);
      if (safeTo) fu += "&to=" + encodeURIComponent(safeTo);

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

    // ===== (3) DART 캐싱 프록시 (?dart=) — 키는 Secret DART_KEY 주입, 1시간 캐시 =====
    const dart = url.searchParams.get("dart");
    if (dart) {
      if (dart !== "list") {
        return new Response("dart endpoint not allowed", { status: 403, headers: cors() });
      }
      const key = env && env.DART_KEY;
      if (!key) return new Response("DART_KEY not set on worker", { status: 500, headers: cors() });
      const num = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };
      const ymd = v => (/^\d{8}$/.test(v || "") ? v : "");
      const detailOk = new Set(["D001", "D002"]);
      const detail = detailOk.has(url.searchParams.get("detail")) ? url.searchParams.get("detail") : "D001";
      const bgn = ymd(url.searchParams.get("bgn")), end = ymd(url.searchParams.get("end"));
      const page = num(url.searchParams.get("page"), 1, 50), count = num(url.searchParams.get("count"), 20, 100);
      let du = "https://opendart.fss.or.kr/api/list.json?crtfc_key=" + key +
        "&pblntf_ty=D&pblntf_detail_ty=" + detail + "&page_no=" + page + "&page_count=" + count;
      if (bgn) du += "&bgn_de=" + bgn;
      if (end) du += "&end_de=" + end;
      try {
        const r = await fetch(du, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, cf: { cacheTtl: 3600, cacheEverything: true } });
        const body = await r.text();
        return new Response(body, {
          status: r.status,
          headers: { ...cors(), "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "X-Richflow-Cache": "dart-1h" },
        });
      } catch (e) {
        return new Response("dart error: " + e.message, { status: 502, headers: cors() });
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
