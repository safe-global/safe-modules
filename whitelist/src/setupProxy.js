const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use(
    '/sapp',
    createProxyMiddleware({
      target: 'https://localhost:3002',
      changeOrigin: true,
      secure: false,
      onProxyRes: (proxyRes, req, res) => {
        Object.assign(proxyRes.headers, {
            "Access-Control-Allow-Origin": "\*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        })
      },
      pathRewrite: {
        '^/sapp': '/'
      }
    })
  );
};