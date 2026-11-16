const { takeCoverage } = require('node:v8');

process.once('SIGTERM', () => {
  try {
    takeCoverage();
  } finally {
    process.exit(0);
  }
});
