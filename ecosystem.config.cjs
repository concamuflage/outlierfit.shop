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
