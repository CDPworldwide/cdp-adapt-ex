import { defineConfig } from "vitepress";

export default defineConfig({
  title: "CDP Adaptation & Action Explorer",
  description:
    "How the CDP Adaptation & Action Explorer is structured and operated.",
  base: "/cdp-adapt-ex/",
  cleanUrls: true,
  ignoreDeadLinks: [
    (url) => url.startsWith("../") || url.startsWith("./../"),
  ],
  themeConfig: {
    logo: "/images/landing-page.png",
    nav: [
      { text: "Overview", link: "/" },
      { text: "Data", link: "/data" },
      { text: "Deployment", link: "/deployment" },
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Data", link: "/data" },
          { text: "Data Pipeline", link: "/data_pipeline" },
          { text: "Deployment", link: "/deployment" },
          { text: "Translation", link: "/translation" },
        ],
      },
      {
        text: "Backend",
        items: [
          { text: "Overview", link: "/backend/" },
          { text: "Database", link: "/backend/database" },
          { text: "Hazard Service", link: "/backend/hazard-service" },
        ],
      },
      {
        text: "AI Server",
        items: [
          { text: "Overview", link: "/ai-server/" },
          { text: "Testing", link: "/ai-server/testing" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/CDPworldwide/cdp-adapt-ex" },
    ],
    search: {
      provider: "local",
    },
  },
});
