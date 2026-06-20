module.exports = {
  apps: [
    {
      name: "API",
      script: "pnpm",
      args: "run dev",
    },
    {
      name: "WORKER",
      script: "pnpm",
      args: "run worker",
    },
    {
      name: "DISPATCHER",
      script: "pnpm",
      args: "run dispatcher",
    }
  ]
};