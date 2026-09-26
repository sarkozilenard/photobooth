# PHOTO BOOTH

iPhone 11 kamera + iPad vendégkijelző. Next.js alkalmazás, Vercelre telepíthető, helyi szerver nélkül.

## Hogyan működik

1. Az **iPad** a booth felület: élő kép, visszaszámlálás, előnézet, megosztás.
2. Az **iPhone** a kamera: WebRTC-n küldi az élőképet, a fotót helyben is elmenti, és feltölti a felhőbe.
3. A két eszköz HTTPS-en beszél. A jelzés serverless API-n megy, a videó peer-to-peer (STUN, opcionális TURN).

```
iPhone (kamera)  --WebRTC-->  iPad (booth)
        \                         /
         \----- HTTPS API -------/
                  Vercel
```

## Indítás

```bash
npm install
cp .env.example .env.local
npm run dev
```

- Helyi: [http://localhost:3000](http://localhost:3000)
- iPhone / iPad ugyanazon a Wi-Fi-n: a terminalben megjelenő **Network** URL (pl. `http://192.168.x.x:3000`)

Ha a Next.js blokkolja a hálózati hostot, add hozzá a géped IP-jét a `next.config.ts` `allowedDevOrigins` listájához.

### Eseményen

1. `Új booth` → jegyezd meg a 6 karakteres kódot.
2. iPaden: **iPad booth**, Add to Home Screen, teljes képernyő.
3. iPhone-on: QR vagy `/camera/KÓD` → **Kamera indítása**.
4. A vendég csak a **Fotózás** gombot nyomja meg.

Teszt egy eszközön: **Teszt helyi kamerával**.

Admin: `/admin`  
Fejlesztésben a jelszó: `photobooth` (állítsd át `ADMIN_PASSWORD`-re productionben).

## Vercel

1. Repo csatolása a Vercelhez.
2. Environment: `ADMIN_PASSWORD`, `ADMIN_SECRET`.
3. **Vercel Blob** store + `BLOB_READ_WRITE_TOKEN` — fotók és session állapot több instance között.
4. Opcionális: Resend (`RESEND_API_KEY`, `EMAIL_FROM`) az e-mail megosztáshoz.
5. Ha az iPhone 4G-n, az iPad Wi-Fi-n van, kell egy **TURN** szerver (`NEXT_PUBLIC_TURN_*`).

A Blob nélkül a rendszer memóriában / `.data/` mappában tárol (helyi `next dev` / `next start`). Vercel serverless environmentben a Blob kell a stabil jelzéshez és a fotókhoz.

## Megosztás

- **AirDrop**: iPad Safari `navigator.share` → natív lap, AirDroppel.
- **E-mail**: letöltési link (Resend, ha be van állítva).
- **QR**: ideiglenes, tokenes `/p/[id]?t=...` URL.

## Ring light

A USB ring light maradjon bekapcsolva. A booth a fotó pillanatában fehér flash overlay-t ad. Hardveres vezérléshez később: `NEXT_PUBLIC_RING_LIGHT_WEBHOOK` vagy `lib/hardware/ring-light.ts`.

## Továbbfejlesztés

A `lib/effects/registry.ts` és `lib/camera/` szándékosan bővíthető:

- több fotó / session, kollázs, GIF, boomerang
- keret, vízjel, branding, háttércsere
- Instagram / TikTok vágás
- QR-galéria
- natív iPhone kamera app (`lib/camera/native-bridge.ts`)

## Technika

- Next.js App Router, TypeScript, Tailwind
- WebRTC élőkép + HTTP jelzés
- Fotó: IndexedDB retry queue az iPhone-on, automatikus újratöltés
- PWA / fullscreen iPad
- Jelszavas admin
