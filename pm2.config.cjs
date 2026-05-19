module.exports = {
  apps: [
    {
      name: 'ccswitch-deepseek',
      script: 'index.deepseek.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ccswitch-minimax',
      script: 'index.minimax.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
