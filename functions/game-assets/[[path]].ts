import {
  buildAssetKey,
  fallbackContentType,
  isApprovedRelease,
  parseByteRange,
  parseAssetPath
} from "../../src/lib/game-assets";

interface GameAssetsEnv extends Env {
  GAME_ASSETS_ENABLE_FIXTURE?: string;
}

export const onRequest: PagesFunction<GameAssetsEnv> = async (context) => {
  const method = context.request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  const parsed = parseAssetPath(context.params.path);
  if (!parsed) return new Response(null, { status: 404 });

  const allowFixture = context.env.GAME_ASSETS_ENABLE_FIXTURE === "true";
  if (
    !isApprovedRelease(
      parsed.slug,
      parsed.version,
      allowFixture,
      context.env.BRIDGE_BUILDER_PREVIEW_VERSION,
      context.env.NUMBER_LINE_JUMPER_PREVIEW_VERSION
    )
  ) {
    return new Response(null, { status: 404 });
  }

  const key = buildAssetKey(parsed);
  try {
    const requestRange = context.request.headers.get("range");
    const object = requestRange
      ? await context.env.GAME_ASSETS.get(key, { range: context.request.headers })
      : await context.env.GAME_ASSETS.get(key);
    if (!object) return new Response(null, { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("accept-ranges", "bytes");
    headers.set("x-content-type-options", "nosniff");
    headers.set(
      "cache-control",
      headers.get("cache-control") ?? "public, max-age=31536000, immutable"
    );
    headers.set(
      "content-type",
      headers.get("content-type") ?? fallbackContentType(parsed.assetPath)
    );

    const byteRange = parseByteRange(requestRange, object.size);
    if (requestRange && !byteRange) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${object.size}` }
      });
    }

    if (byteRange) {
      headers.set("content-range", `bytes ${byteRange.start}-${byteRange.end}/${object.size}`);
      headers.set("content-length", String(byteRange.length));
    } else {
      headers.set("content-length", String(object.size));
    }

    return new Response(method === "HEAD" ? null : object.body, {
      status: byteRange ? 206 : 200,
      headers
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "game_asset_read_failed",
        key,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return new Response("Game asset unavailable", { status: 503 });
  }
};
