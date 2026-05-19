export default {
  apps: [
    {
      name: 'ccswitch-deepseek',
      script: 'index.deepseek.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ccswitch-minimax',
      script: 'index.minimax.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
