const app = require('../server/index');

// Vercel serverless function export
module.exports = (req, res) => {
  // Vercel passes the request and response objects to the app
  return app(req, res);
};