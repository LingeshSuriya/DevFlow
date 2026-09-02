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
