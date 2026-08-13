import { useAuthStore } from "@/store/authStore";
import { getApiUrl } from "@/services/configService";
import type { Lecture, LectureDetail, Note } from "@/types/lecture";
import type { QuizQuestion, ChatMessage } from "@/types/quiz";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${getApiUrl()}${path}`;
  console.log("➡️ Request:", url, options);

  try {
    const res = await fetch(url, { ...options, headers });
    console.log("⬅️ Response status:", res.status);

    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body || res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    console.error("❌ Network error in request:", err);
    throw err;
  }
}

export const api = {
  get API_URL() {
    return getApiUrl();
  },

  // --- Auth ---
  async register(email: string, password: string, fullName?: string) {
    console.log("📝 Registering:", email);
    return request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
  },

  async login(email: string, password: string) {
    console.log("🔑 Logging in with:", email);
    const body = new URLSearchParams();
    body.append("username", email);
    body.append("password", password);

    try {
      const res = await fetch(`${getApiUrl()}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      console.log("⬅️ Login response status:", res.status);

      if (!res.ok) throw new ApiError(res.status, await res.text());
      return res.json() as Promise<{ access_token: string; token_type: string }>;
    } catch (err) {
      console.error("❌ Network error in login:", err);
      throw err;
    }
  },

  // --- Lectures ---
  async startLecture(title: string) {
    return request<Lecture>("/api/v1/lectures", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async listLectures() {
    return request<Lecture[]>("/api/v1/lectures");
  },

  async getLecture(id: string) {
    return request<LectureDetail>(`/api/v1/lectures/${id}`);
  },

  async endLecture(id: string) {
    return request<Lecture>(`/api/v1/lectures/${id}/end`, { method: "POST" });
  },

  // --- Notes ---
  async listNotes(lectureId: string) {
    return request<Note[]>(`/api/v1/lectures/${lectureId}/notes`);
  },

  // --- Quiz ---
  async generateQuiz(lectureId: string, questionCount = 10) {
    return request<QuizQuestion[]>(`/api/v1/lectures/${lectureId}/quiz/generate`, {
      method: "POST",
      body: JSON.stringify({ question_count: questionCount }),
    });
  },

  async listQuiz(lectureId: string) {
    return request<QuizQuestion[]>(`/api/v1/lectures/${lectureId}/quiz`);
  },

  // --- Chat ---
  async askQuestion(lectureId: string, message: string) {
    return request<ChatMessage>(`/api/v1/lectures/${lectureId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async getChatThread(lectureId: string) {
    return request<ChatMessage[]>(`/api/v1/lectures/${lectureId}/chat`);
  },
};

export { ApiError };