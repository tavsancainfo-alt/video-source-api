# Video Source API

Small Vercel API skeleton for connecting a WordPress/Dooplay site to approved video sources.

## Test

```text
/api/source?tmdb=536208
```

Expected response:

```json
{
  "tmdb": "536208",
  "sources": []
}
```

## Proxy

Allowlisted media proxy for learning and public test streams:

```text
/api/proxy?url=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8
```

Allowed hosts are controlled with `PROXY_ALLOWED_HOSTS`, comma-separated.
By default it allows public demo stream hosts only.
