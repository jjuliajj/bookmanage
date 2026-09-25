import { NextRequest, NextResponse } from "next/server";

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({
        url: targetUrl,
        title: targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        description: "",
        image: "",
        site_name: new URL(targetUrl).hostname.replace("www.", ""),
      });
    }

    const html = await res.text();

    // Extract Title
    const titleMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?title["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : targetUrl.replace(/^https?:\/\//, "");

    // Extract Description
    const descMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?description["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : "";

    // Extract Image
    const imgMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?image(?:SecureUrl)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?image(?:SecureUrl)?["']/i);
    let image = imgMatch ? imgMatch[1].trim() : "";
    if (image && image.startsWith("//")) {
      image = `https:${image}`;
    } else if (image && image.startsWith("/")) {
      const u = new URL(targetUrl);
      image = `${u.origin}${image}`;
    }

    // Extract Site Name
    const siteMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:)?site_name["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?site_name["']/i);
    const site_name = siteMatch
      ? decodeHtmlEntities(siteMatch[1].trim())
      : targetUrl.includes("whop.com")
      ? "Whop"
      : new URL(targetUrl).hostname.replace("www.", "");

    return NextResponse.json({
      url: targetUrl,
      title,
      description,
      image,
      site_name,
    });
  } catch (err: any) {
    console.warn("Preview fetch error:", err?.message);
    const hostname = (() => {
      try {
        return new URL(targetUrl).hostname.replace("www.", "");
      } catch {
        return "Web";
      }
    })();

    return NextResponse.json({
      url: targetUrl,
      title: targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      description: "",
      image: "",
      site_name: targetUrl.includes("whop.com") ? "Whop" : hostname,
    });
  }
}
