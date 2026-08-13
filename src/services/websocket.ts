import Constants from "expo-constants";
import type { LectureSocketEvent } from "@/types/lecture";

const WS_URL = (Constants.expoConfig?.extra?.wsUrl as string) ?? "ws://localhost:8000";

type EventHandler = (event: LectureSocketEvent) => void;
type StatusHandler = (status: "connecting" | "open" | "closed" | "error") => void;

export class LectureSocket {
  private ws: WebSocket | null = null;
  private lectureId: string;
  private token: string;
  private onEvent: EventHandler;
  private onStatus: StatusHandler;
  private reconnectAttempts = 0;
  private shouldReconnect = true;

  constructor(lectureId: string, token: string, onEvent: EventHandler, onStatus: StatusHandler) {
    this.lectureId = lectureId;
    this.token = token;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  connect() {
    this.shouldReconnect = true;
    this.onStatus("connecting");
    const url = `${WS_URL}/ws/lectures/${this.lectureId}/stream?token=${this.token}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatus("open");
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as LectureSocketEvent;
        this.onEvent(data);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onerror = () => {
      this.onStatus("error");
    };

    this.ws.onclose = () => {
      this.onStatus("closed");
      if (this.shouldReconnect && this.reconnectAttempts < 5) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
        this.reconnectAttempts += 1;
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  /** Send a raw PCM16 audio chunk (ArrayBuffer/Buffer) to the server. */
  sendAudioChunk(chunk: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  /** Tell the server recording has ended, then close cleanly. */
  end() {
    this.shouldReconnect = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send("END");
    }
    this.ws?.close();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
git