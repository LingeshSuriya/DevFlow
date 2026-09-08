import { io } from "socket.io-client";

export const socket = io("http://localhost:5000", {
  autoConnect: false,
});

export function connectSocket(token) {
  socket.auth = { token };
  if (socket.connected) socket.disconnect();
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}

export function joinOrgRoom(orgId) {
  if (orgId) socket.emit("org:join", orgId);
}
export function leaveOrgRoom(orgId) {
  if (orgId) socket.emit("org:leave", orgId);
}

export function joinReviewRoom(reviewId) {
  if (reviewId) socket.emit("review:join", reviewId);
}
export function leaveReviewRoom(reviewId) {
  if (reviewId) socket.emit("review:leave", reviewId);
}
