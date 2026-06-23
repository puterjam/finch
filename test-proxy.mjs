// 本地测试代理 — 模拟 Cloudflare Workers 行为
// 用法: node test-proxy.mjs
// 测试: curl -I http://localhost:3456/v1.4.2/Finch-1.4.2-arm64.dmg

import http from 'node:http'
import https from 'node:https'

const PORT = 3456
const GITHUB_OWNER = 'puterjam'
const GITHUB_REPO = 'finch'

const server = http.createServer((req, res) => {
  const match = req.url.match(/^\/(v[^/]+)\/(.+)$/)
  if (!match) {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  const [_, version, filename] = match
  const targetUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${version}/${filename}`

  console.log(`[PROXY] ${req.url} → ${targetUrl}`)

  https.get(targetUrl, { 
    headers: {
      'User-Agent': 'Finch-Test-Proxy',
      'Accept': '*/*',
      'Range': req.headers['range'] || '',
    }
  }, (proxyRes) => {
    // 302 重定向处理（GitHub 会 302 到 CDN）
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      console.log(`[REDIRECT] → ${proxyRes.headers.location}`)
      https.get(proxyRes.headers.location, { headers: { 'User-Agent': 'Finch-Test-Proxy' } }, (finalRes) => {
        res.writeHead(finalRes.statusCode, {
          'Content-Type': finalRes.headers['content-type'] || 'application/octet-stream',
          'Content-Length': finalRes.headers['content-length'] || '',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        })
        finalRes.pipe(res)
      })
      return
    }

    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Content-Length': proxyRes.headers['content-length'] || '',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    })
    proxyRes.pipe(res)
  }).on('error', (err) => {
    console.error(`[ERROR] ${err.message}`)
    res.writeHead(502)
    res.end('Proxy Error: ' + err.message)
  })
})

server.listen(PORT, () => {
  console.log(`\n  Finch Release Proxy 本地服务已启动\n`)
  console.log(`  测试链接:\n`)
  console.log(`  http://localhost:${PORT}/v1.4.2/Finch-1.4.2-arm64.dmg`)
  console.log(`  http://localhost:${PORT}/v1.4.2/Finch-1.4.2-x64.dmg`)
  console.log(`  http://localhost:${PORT}/v1.4.2/Finch-1.4.2-setup-x64.exe`)
  console.log(`  http://localhost:${PORT}/v1.4.2/Finch-1.4.2-setup-ia32.exe`)
  console.log(`\n  打开浏览器访问以上链接验证下载是否正常\n`)
  console.log(`  Ctrl+C 停止服务\n`)
})
