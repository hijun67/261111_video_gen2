import { getStore } from "@netlify/blobs";
export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  const s = id ? await getStore("videos").get(id, { type: "json" }) : null;
  return Response.json(s || { status: "pending" });
};
