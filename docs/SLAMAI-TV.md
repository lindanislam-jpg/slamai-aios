# SlamAI TV

A player for live TV, at `/tv`. Same code on the laptop browser and the phone —
it installs to a home screen as an app.

It is deliberately separate from the business product: it does not touch
accounts, Stripe, Prisma or the dashboard, and it is not part of what you sell
to SlamAI customers.

---

## What it is, and what it is not

**It is a player.** It holds no channels. Every channel comes from a playlist
you choose:

| Where channels come from | How |
|---|---|
| Free-to-air channels worldwide | The built-in catalog (Sources → Free catalog) |
| A subscription you pay for | Sources → Playlist URL, or Provider login |

**It does not** unlock, decrypt, re-host or resell anyone's channels. Free
streams work because broadcasters publish them. A paid service works only
because you already pay for it. There is no code here that gets around anybody's
access control, and there should never be — it is illegal, it gets taken down,
and it cannot be sold.

The free catalog points at playlists published by the open-source
[iptv-org](https://github.com/iptv-org/iptv) project, which indexes channels
broadcasters stream publicly themselves.

---

## Running it

```
Start SlamAI TV.bat          ← Windows, double-click
npm run dev                  ← then open http://localhost:3005/tv
```

**On your phone**, on the same Wi-Fi: find the laptop's IP (`ipconfig` on
Windows, `ifconfig` on Mac) and open `http://THAT-IP:3005/tv`. Then:

- **iPhone/iPad** — Safari → Share → Add to Home Screen
- **Android** — Chrome → menu → Install app

The laptop has to be switched on and running the app for the phone to work.
To watch when the laptop is off, the app has to be deployed somewhere — see
"Deploying" below.

---

## Where to edit

| I want to change… | Go to |
|---|---|
| Which free playlists are offered | `src/lib/tv/sources.ts` → `CATALOG` |
| Which sources a new install starts with | `src/lib/tv/sources.ts` → `STARTER_SOURCE_IDS` |
| Colours, spacing, the whole look | `src/app/tv/tv.css` (one token block at the top) |
| The browse page, filters, search | `src/app/tv/page.tsx` |
| The channel card and grid | `src/components/tv/ChannelGrid.tsx` |
| Playback, errors, player controls | `src/components/tv/Player.tsx` |
| Header, tab bar, navigation | `src/components/tv/Shell.tsx` |
| Favourites, history, settings storage | `src/lib/tv/store.tsx` |
| M3U parsing / provider login → URL | `src/lib/tv/m3u.ts` |
| HLS manifest rewriting | `src/lib/tv/hls.ts` |
| Playlist fetching | `src/app/api/tv/playlist/route.ts` |
| Stream proxying | `src/app/api/tv/proxy/route.ts` |
| Blocking unsafe URLs (SSRF guard) | `src/lib/tv/net.ts` |
| App name, icon, install behaviour | `public/tv-manifest.webmanifest`, `public/tv-icon.svg` |

---

## How it works

```
Browser                     This app                     The internet
───────                     ────────                     ────────────
Sources page
  pick a playlist   ──►  /api/tv/playlist   ──►  fetches the .m3u
                          parses it                (playlist host)
                          returns channels
Browse page
  tap a channel     ──►  /api/tv/proxy      ──►  fetches the .m3u8
                          rewrites URLs            (broadcaster CDN)
                          streams segments
  hls.js plays it
```

**Why the proxy exists.** A browser can only play a stream whose host sends CORS
headers, and most broadcast CDNs do not. Without the proxy about half the free
channels fail with an unexplained network error. The proxy fetches the manifest,
rewrites the URLs inside it to point back at the app, and passes the video
segments straight through. Settings has a switch to turn it off per device —
some streams are faster direct.

**Where the filters come from.** Filter chips are built from whatever the
loaded playlists actually contain, so no filter is ever offered with nothing
behind it. Worth knowing about the free catalog specifically:

- **Genre** — present on 100% of channels.
- **Country** — the playlists no longer publish `tvg-country`, so it is derived
  from the channel id instead (`5USA.uk@SD` → `uk`). That covers 100% of the
  world index. If this ever stops working, country chips and flags disappear
  silently — `countryFromTvgId` in `src/lib/tv/m3u.ts` is the place to look.
- **Language** — genuinely absent from this data, so the Language filter hides
  itself. Use the per-language playlists under Sources instead. A paid
  provider's own playlist often does carry language, and the filter reappears
  by itself when it does.

**Nothing is stored server-side.** Sources, favourites and history live in
`localStorage` on each device. The app has no account and keeps no record of
what anyone watched. Phone and laptop therefore keep separate favourites.

---

## Safety rules the code enforces

These matter, because both API routes fetch a URL the browser handed them.

1. **Private networks are blocked** (`src/lib/tv/net.ts`). `localhost`,
   `10.x`, `192.168.x`, `169.254.169.254` (cloud metadata) and friends are
   refused, and hostnames are resolved first so a DNS name pointing at
   `127.0.0.1` is caught too. Without this, anyone who could reach the app could
   use it to read your internal network.
2. **The proxy is off in production by default.** Deploying this publicly would
   otherwise hand the internet a free relay. Set `TV_PROXY_ENABLED=true` to turn
   it on deliberately.
3. **Playlists are size-capped** (24 MB) and time-capped, so a hostile or
   runaway response cannot exhaust server memory.
4. **Provider credentials never reach this app's server as credentials** — they
   are formatted into your provider's own playlist URL and stored in your
   browser.

---

## Deploying it

Hosting it publicly is a different proposition from running it on your laptop:

- Turn the proxy on explicitly (`TV_PROXY_ENABLED=true`) or streams will not
  play — and understand that every stream then flows through your server, which
  costs bandwidth and can get the host's abuse team's attention.
- Put it behind a login if it is on a public URL. There is no auth on `/tv` by
  design, because it was built for your own devices.
- Honestly, for personal use, leaving it on the laptop and opening it from the
  phone over Wi-Fi is simpler, free, and has none of these problems.

---

## Known limits

- **Some channels will not play.** Public playlists always contain dead entries,
  geo-blocked streams and channels that moved. Settings → "Hide channels that
  failed" cleans up the list as you go.
- **No programme guide (EPG).** Playlists carry channel names, not schedules.
  Adding one means parsing XMLTV, which is a separate piece of work.
- **No recording or catch-up.** It plays live streams only.
- **No casting to a TV built in.** Chrome's own "Cast" on the video element
  works on Android; AirPlay works from Safari.
