module.exports = {
  apps: [
    {
      name: "moonbags",
      cwd: __dirname,
      script: "src/main.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      time: true,
    },
  ],
};
