import { getStore } from "@netlify/blobs";
export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  const data = id ? await getStore("videos").get(id + ".mp4", { type: "arrayBuffer" }) : null;
  if (!data) return new Response("not found", { status: 404 });
  return new Response(data, { headers: { "Content-Type": "video/mp4", "Content-Disposition": "inline; filename=product-video.mp4" } });
};
