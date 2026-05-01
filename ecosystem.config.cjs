const workspace = process.env.WORKSPACE || "/var/lib/jenkins/workspace/AsianFitPipeLine";

module.exports = {
  apps: [
    {
      name: "project888-web",
      cwd: workspace,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        APP_URL: process.env.APP_URL || "https://asianfit.shop",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://asianfit.shop",
      },
    },
    {
      name: "project888-api",
      cwd: `${workspace}/backend`,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
