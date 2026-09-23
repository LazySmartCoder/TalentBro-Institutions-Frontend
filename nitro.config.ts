import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  routeRules: {
    "/api/**": {
      proxy: { to: "http://ins-api.talentbro.in/api/**" },
    },
    "/media/**": {
      proxy: { to: "http://ins-api.talentbro.in/media/**" },
    },
  },
});
