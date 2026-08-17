module.exports = {
  apps: [
    {
      name: "calorie-vision",
      cwd: "/var/www/calorie-vision",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
