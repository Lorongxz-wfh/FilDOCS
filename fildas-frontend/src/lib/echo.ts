import Echo from "laravel-echo";
import Pusher from "pusher-js";

import api from "../services/api";

(window as any).Pusher = Pusher;

const authPromiseCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

const echo = new Echo({
  broadcaster: "pusher",
  key: import.meta.env.VITE_PUSHER_APP_KEY,
  cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
  forceTLS: true,
  authorizer: (channel: any) => ({
    authorize: (socketId: string, callback: any) => {
      const cacheKey = `${socketId}:${channel.name}`;
      const cached = authPromiseCache.get(cacheKey);
      const now = Date.now();

      // Cache auth responses for 1 second to prevent bursts during multi-channel join
      if (cached && now - cached.timestamp < 1000) {
        cached.promise
          .then((data) => callback(false, data))
          .catch((err) => callback(true, err));
        return;
      }

      const promise = api
        .post("/broadcasting/auth", {
          socket_id: socketId,
          channel_name: channel.name,
        })
        .then((res) => res.data);

      authPromiseCache.set(cacheKey, { promise, timestamp: now });

      promise
        .then((data) => callback(false, data))
        .catch((err) => callback(true, err));
    },
  }),
});

export default echo;
