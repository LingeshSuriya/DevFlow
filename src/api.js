const BASE_URL = "http://localhost:5000/api";

let getToken = () => null;
export function setTokenGetter(fn) {
  getToken = fn;
}

async function request(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch (networkErr) {
    // fetch() itself throws on connection failure — this is NOT a 4xx/5xx from the server.
    throw new Error(
      `Can't reach the API at ${BASE_URL}. Is the backend running? (npm run dev inside /server)`
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/auth/me"),
  githubLoginUrl: () => `${BASE_URL}/auth/github`,

  getUsers: () => request("/users"),

  getTasks: () => request("/tasks"),
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  moveTask: (id, status) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getChannels: () => request("/channels"),
  getMessages: (channelId) => request(`/channels/${channelId}/messages`),
  sendMessage: (channelId, data) =>
    request(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(data) }),
};
