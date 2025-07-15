If you use discord in a computer where (only) the cdn.discordapp.com is blocked, this plugin is for you!

Ok, at last you need your own server + your domain to create everything (pretty easy, tbh) that will proxy the cdn to your domain.

For example, my setup includes a raspberry but it should works with any vps.

# Steps

If we considerate that you have already created on your registar the `www.cdn.mywebsite.com`

## Proxy nodejs
You need:
- Node
- Bun (`npm i -g bun`)
- `pm2`

```
mkdir proxy-cdn
bun init
bun add express http-proxy-middleware
```

change the `index.ts` by this:
```ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(
  "/",
  createProxyMiddleware({
    target: "https://cdn.discordapp.com",
    changeOrigin: true,
    pathRewrite: { "^/": "/" },
    secure: true,
    onProxyReq: (proxyReq, req, res) => {
      console.log("➡️  Proxy request for:", req.url);
      proxyReq.setHeader("Host", "cdn.discordapp.com");
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (compatible; DiscordCDNProxy/1.0)");
      proxyReq.setHeader("Accept", "*/*");
      proxyReq.setHeader("Accept-Encoding", "identity"); 
    },
    onError: (err, req, res) => {
      console.error("❌ Proxy error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error discord proxy!");
    },
  })
);

app.listen(3000, () => {
  console.log("✅ Proxy Discord listen on http://localhost:3000");
});
```

And start with: `pm2 start --name cdn-proxy "bun index.ts"`

## Enable https with certbot

```
sudo apt install certbot python3-certbot-nginx
```

and generate:
```
sudo certbot --nginx -d www.cdn.mywebsite.com
```

## Redirect with nginx

Use `sudo nano /etc/nginx/sites-available/discord-cdn`
Paste this: (don't forget to update the links!)
```
server {
    listen 443 ssl;
    server_name www.cdn.mywebsite.com;

    ssl_certificate /etc/letsencrypt/live/www.cdn.mywebsite.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.cdn.mywebsite.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host cdn.discordapp.com;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Accept-Encoding "";
    }
}

server {
    listen 80;
    server_name www.cdn.mywebsite.com;

    if ($host = www.cdn.mywebsite.com) {
        return 301 https://$host$request_uri;
    }

    return 404;
}
```

and then activate:
```
sudo ln -s /etc/nginx/sites-available/discord-cdn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

If everything is alright, you can test it with taking any discord cdn and replace it with `www.cdn.mywebsite.com`.

For example, using the vencord server picture: `www.cdn.mywebsite.com/icons/1015060230222131221/05d0bab6a308b45dc41465086f0d5701.png?size=80&quality=lossless` should works!

## Finally

Enable this plugin as any other userplugins. Don't forget to change the cdn!

> [!warning]
> You first need to go into `themes` to allow your cdn!

