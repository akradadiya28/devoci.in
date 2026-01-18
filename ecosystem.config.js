module.exports = {
  apps: [
    {
      name: 'devoci-api',
      script: 'dist/index.js',
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster', // Enable clustering
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      exp_backoff_restart_delay: 100,
    },
  ],
};
