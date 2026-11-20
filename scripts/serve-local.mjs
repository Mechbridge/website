// Local run of the production server (for testing). Port 4322, data in ./data.
process.env.PORT ||= '4322';
process.env.HOST ||= '127.0.0.1';
await import('../dist/server/entry.mjs');
