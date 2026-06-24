/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://clearpath.wahb.space",
  generateRobotsTxt: false, // We manage robots.txt manually
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 5000,
  exclude: [
    "/analyze",
    "/history",
    "/history/*",
    "/saved",
    "/profile",
    "/settings",
    "/api/*",
    "/login",
    "/register",
  ],
  additionalPaths: async (config) => [
    { loc: "/", changefreq: "daily", priority: 1.0 },
    { loc: "/about", changefreq: "monthly", priority: 0.8 },
    { loc: "/help-center", changefreq: "monthly", priority: 0.7 },
    { loc: "/safety", changefreq: "monthly", priority: 0.7 },
    { loc: "/feedback", changefreq: "monthly", priority: 0.5 },
  ],
};
