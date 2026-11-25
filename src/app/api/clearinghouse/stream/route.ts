import { NextRequest } from "next/server";
import { loadClearinghouseState } from "@/lib/server-ledger";
import {
  getRealtimeVersion,
  RealtimeChangeEvent,
  subscribeClearinghouseUpdates,
} from "@/lib/realtime-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GO_BACKEND_URL =
  process.env.GO_BACKEND_URL || "http://127.0.0.1:8081";

async function fetchLiveState() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/v1/state`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback ke penyimpanan lokal persisten (.civicledger-ledger.json)
  } finally {
    clearTimeout(timeout);
  }
  return loadClearinghouseState();
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastDigest = "";

      const sendState = async (action: string, version: number) => {
        if (closed) return;
        try {
          const state = await fetchLiveState();
          const serialized = JSON.stringify({
            type: "STATE_UPDATE",
            action,
            version,
            updated_at: new Date().toISOString(),
            state,
          });
          if (action === "POLL_CHECK" && serialized.slice(serialized.indexOf('"state":')) === lastDigest) {
            return;
          }
          lastDigest = serialized.slice(serialized.indexOf('"state":'));
          controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
        } catch {
          // Abaikan jika stream sudah ditutup client
        }
      };

      // Kirim data awal langsung saat tersambung
      await sendState("INIT", getRealtimeVersion());

      // Dorong pembaruan instan setiap kali ada mutasi di server
      const unsubscribe = subscribeClearinghouseUpdates(
        (ev: RealtimeChangeEvent) => {
          void sendState(ev.action, ev.version);
        }
      );

      // Heartbeat + deteksi perubahan eksternal (misal dari backend Go langsung)
      const interval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
          void sendState("POLL_CHECK", getRealtimeVersion());
        } catch {
          closed = true;
          clearInterval(interval);
          unsubscribe();
        }
      }, 3000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
