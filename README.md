# W&K Reserve

Direct booking site for the W&K Reserve Poconos estates. The app is in
[`wk-reserve/`](wk-reserve/README.md): Next.js on Vercel, with Hospitable as
the system of record and Hospitable's hosted checkout taking every payment.

```bash
cd wk-reserve
npm install
cp .env.example .env.local   # add HOSPITABLE_PAT
npm run dev
```

On Vercel, set the project's **Root Directory** to `wk-reserve`.
