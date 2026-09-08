const BASE_URL = "http://localhost:5000/api";

let getToken = () => null;
let getOrgId = () => null;

export function setTokenGetter(fn) {
  getToken = fn;
}
export function setOrgIdGetter(fn) {
  getOrgId = fn;
}

async function request(path, options = {}) {
  const token = getToken();
  const orgId = getOrgId();

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(orgId ? { "X-Org-Id": orgId } : {}),
      },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(`Can't reach the API at ${BASE_URL}. Is the backend running? (npm run dev inside /server)`);
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

  getOrgs: () => request("/orgs"),
  createOrg: (data) => request("/orgs", { method: "POST", body: JSON.stringify(data) }),
  getOrgMembers: (orgId) => request(`/orgs/${orgId}/members`),
  inviteMember: (orgId, data) => request(`/orgs/${orgId}/invite`, { method: "POST", body: JSON.stringify(data) }),

  getUsers: () => request("/users"),

  getTasks: () => request("/tasks"),
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  moveTask: (id, status) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getChannels: () => request("/channels"),
  getMessages: (channelId) => request(`/channels/${channelId}/messages`),
  sendMessage: (channelId, data) => request(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(data) }),

  getBugs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bugs${qs ? `?${qs}` : ""}`);
  },
  getBug: (id) => request(`/bugs/${id}`),
  createBug: (data) => request("/bugs", { method: "POST", body: JSON.stringify(data) }),
  updateBug: (id, data) => request(`/bugs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addBugComment: (id, data) => request(`/bugs/${id}/comments`, { method: "POST", body: JSON.stringify(data) }),

  getReviews: () => request("/reviews"),
  getReview: (id) => request(`/reviews/${id}`),
  createReview: (data) => request("/reviews", { method: "POST", body: JSON.stringify(data) }),
  updateReview: (id, data) => request(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addReviewComment: (id, data) => request(`/reviews/${id}/comments`, { method: "POST", body: JSON.stringify(data) }),
};
