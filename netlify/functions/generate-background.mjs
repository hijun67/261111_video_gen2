// Netlify 백그라운드 함수(최대 15분). Gemini Omni Flash로 영상 생성 후 Blobs에 저장
import { getStore } from "@netlify/blobs";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export default async (req) => {
  const store = getStore("videos");
  const b = await req.json();
  const id = b.jobId;
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.VIDEO_MODEL || "gemini-omni-1.1-flash";
  const fail = (m) => store.setJSON(id, { status: "failed", error: m });
  try {
    if (!key) return await fail("GEMINI_API_KEY 환경변수가 없습니다.");
    await store.setJSON(id, { status: "running" });

    const input = [
      ...(b.images || []).map(im => ({ type: "image", data: im.data, mime_type: im.mime })),
      { type: "text", text: b.prompt },
    ];
    const r = await fetch(`${BASE}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ model, input, response_format: { type: "video", aspect_ratio: b.aspect || "9:16", delivery: "uri" } }),
    });
    const d = await r.json();
    if (!r.ok) return await fail(d.error?.message || `생성 요청 실패 (${r.status})`);

    const vid = (d.steps || []).flatMap(s => s.content || []).find(c => c.type === "video") || d.output_video;
    if (!vid) return await fail("영상이 생성되지 않았습니다(안전 필터 가능성). 다른 이미지/문구로 시도해 보세요.");

    let bytes;
    if (vid.data) {
      bytes = Buffer.from(vid.data, "base64");
    } else {
      const fid = (vid.uri.match(/files\/([A-Za-z0-9_-]+)/) || [])[1];
      for (let i = 0; i < 60; i++) {
        const f = await (await fetch(`${BASE}/files/${fid}`, { headers: { "x-goog-api-key": key } })).json();
        if (f.state === "ACTIVE") break;
        if (f.state === "FAILED") return await fail("영상 처리 실패");
        await new Promise(r => setTimeout(r, 5000));
      }
      const dl = await fetch(`${BASE}/files/${fid}:download?alt=media`, { headers: { "x-goog-api-key": key }, redirect: "follow" });
      if (!dl.ok) return await fail("영상 다운로드 실패");
      bytes = Buffer.from(await dl.arrayBuffer());
    }
    await store.set(id + ".mp4", bytes);
    await store.setJSON(id, { status: "done" });
  } catch (e) { await fail(e.message); }
};
