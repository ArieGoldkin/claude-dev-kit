# Proxy Support

Route browser traffic through HTTP, HTTPS, or SOCKS proxies.

## Table of Contents

- [Basic Proxy Usage](#basic-proxy-usage)
- [Proxy Authentication](#proxy-authentication)
- [Proxy Bypass](#proxy-bypass)
- [Environment Variable Fallback](#environment-variable-fallback)
- [Session-Wide Proxy](#session-wide-proxy)
- [Common Patterns](#common-patterns)
  - [Corporate Proxy](#corporate-proxy)
  - [Geo-Location Testing](#geo-location-testing)
  - [Debug with Mitmproxy](#debug-with-mitmproxy)
- [Proxy Types](#proxy-types)
- [Cloud Browser Providers](#cloud-browser-providers)
- [Verify Proxy Is Working](#verify-proxy-is-working)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Basic Proxy Usage

```bash
# HTTP proxy
agent-browser open https://example.com --proxy http://proxy.company.com:8080

# HTTPS proxy
agent-browser open https://example.com --proxy https://proxy.company.com:8443

# SOCKS5 proxy
agent-browser open https://example.com --proxy socks5://proxy.company.com:1080
```

## Proxy Authentication

### Inline Credentials

```bash
agent-browser open https://example.com --proxy http://user:password@proxy.company.com:8080

# URL-encoded special characters
agent-browser open https://example.com --proxy http://user:p%40ssword@proxy.company.com:8080
```

### CDP Fetch.authRequired (v0.22.2)

For proxies that challenge with HTTP 407, agent-browser handles authentication automatically via CDP's Fetch.authRequired event when credentials are provided in the proxy URL.

## Proxy Bypass

Use `--proxy-bypass` to skip the proxy for specific hosts:

```bash
agent-browser --proxy http://proxy:8080 \
    --proxy-bypass "localhost,127.0.0.1,*.internal.corp.com" \
    open https://example.com
```

## Environment Variable Fallback

Since v0.22.2, agent-browser falls back to standard proxy environment variables when `--proxy` is not specified:

```bash
export HTTP_PROXY="http://proxy:8080"
export HTTPS_PROXY="http://proxy:8080"
export ALL_PROXY="socks5://proxy:1080"
export NO_PROXY="localhost,127.0.0.1,.internal.corp.com"

agent-browser open https://example.com
# Automatically uses proxy from env vars
```

The `--proxy` flag takes precedence over environment variables.

## Session-Wide Proxy

Set proxy for an entire session:

```bash
agent-browser --session proxied --proxy http://proxy:8080 open https://example.com
agent-browser --session proxied snapshot -i
agent-browser --session proxied click @e1
```

## Common Patterns

### Corporate Proxy

```bash
#!/bin/bash
CORP_PROXY="http://proxy.corp.example.com:8080"

agent-browser --proxy "$CORP_PROXY" \
    --proxy-bypass "*.internal.corp.example.com,localhost" \
    open https://external-site.com

agent-browser snapshot -i
agent-browser get text body
```

### Geo-Location Testing

```bash
#!/bin/bash
# Test from different geographic locations

# US proxy
agent-browser --session us --proxy http://us-proxy.example.com:8080 \
    open https://app.example.com
agent-browser --session us screenshot /tmp/us-view.png

# EU proxy
agent-browser --session eu --proxy http://eu-proxy.example.com:8080 \
    open https://app.example.com
agent-browser --session eu screenshot /tmp/eu-view.png
```

### Debug with Mitmproxy

```bash
#!/bin/bash
# Start mitmproxy in a separate terminal: mitmproxy --listen-port 8080

agent-browser --proxy http://localhost:8080 open https://example.com
# Inspect traffic in mitmproxy
```

## Proxy Types

| Type | URL Format | Use Case |
|------|------------|----------|
| HTTP | `http://host:port` | General web traffic |
| HTTPS | `https://host:port` | Encrypted proxy connection |
| SOCKS4 | `socks4://host:port` | Legacy proxy support |
| SOCKS5 | `socks5://host:port` | All traffic types, DNS through proxy |

## Cloud Browser Providers

As an alternative to proxies, cloud browser providers run the browser remotely:

```bash
# Connect to a cloud browser via CDP endpoint
agent-browser connect ws://cloud-provider.example.com:9222/devtools/browser/...
```

Cloud providers handle geographic distribution and IP rotation natively, avoiding proxy configuration entirely.

## Verify Proxy Is Working

```bash
#!/bin/bash
agent-browser --proxy "$PROXY" open https://httpbin.org/ip
agent-browser get text body
# Should show proxy IP, not your real IP
```

## Troubleshooting

### Connection Refused

```bash
# Check proxy is reachable
curl -x http://proxy:8080 https://example.com

# Verify credentials
curl -x http://user:pass@proxy:8080 https://example.com
```

### SSL Certificate Errors

```bash
# For corporate proxies with custom CA, add to system trust store:

# macOS
security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain corporate-ca.crt

# Linux
cp corporate-ca.crt /usr/local/share/ca-certificates/
update-ca-certificates
```

### Timeout Issues

```bash
agent-browser --proxy http://slow-proxy:8080 \
    --timeout 60000 \
    open https://example.com
```

## Security Considerations

1. **Credential exposure**: Proxy credentials are visible in process list. Use environment variables:
   ```bash
   export PROXY_URL="http://user:pass@proxy:8080"
   agent-browser --proxy "$PROXY_URL" open https://example.com
   ```
2. **Proxy logging**: Proxy server may log all traffic
3. **HTTPS inspection**: Corporate proxies may terminate TLS (MITM)
