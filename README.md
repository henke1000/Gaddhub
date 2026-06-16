# Min hemsida

En gratisvanlig hemsida med enkel adminpanel via Supabase, GitHub och Vercel.

## Filer

- `index.html` - publik hemsida
- `admin.html` - adminpanel
- `styles.css` - design och responsiv layout
- `admin.css` - adminlayout
- `script.js` - laddar och renderar publicerade sidor
- `admin.js` - redigerar sidor, meny, text, layout och bilder
- `config.js` - Supabase-installningar
- `supabase-schema.sql` - tabeller, RLS-regler och storage bucket

## Publicera med GitHub och Vercel

1. Skapa ett repository pa GitHub.
2. Koppla den har lokala mappen till repositoryt:

   ```bash
   git remote add origin https://github.com/DITT-NAMN/DITT-REPO.git
   git add .
   git commit -m "Starta hemsida"
   git push -u origin main
   ```

3. Ga till Vercel och importera GitHub-repositoryt.
4. Valj Framework Preset `Other`.
5. Lamna Build Command och Install Command tomma. Satt Output Directory till `.` om Vercel fragar.

## Supabase setup

1. Skapa ett Supabase-projekt.
2. Oppna SQL Editor i Supabase och kor innehaller i `supabase-schema.sql`.
3. Skapa en adminanvandare i Supabase Authentication.
4. Kor den sista kommenterade SQL-raden i `supabase-schema.sql` med din e-postadress.
5. Oppna `config.js` och fyll i:

   ```js
   window.SITE_CONFIG = {
     siteName: "Min hemsida",
     supabaseUrl: "https://DITT-PROJEKT.supabase.co",
     supabaseAnonKey: "DIN-PUBLIKA-PUBLISHABLE-ELLER-ANON-KEY",
     assetBucket: "site-assets"
   };
   ```

Lagg aldrig in `service_role` eller secret keys i GitHub, Vercel eller frontendkod. Den har sidan ska bara anvanda den publika publishable/anon-nyckeln. Sakerheten ligger i Row Level Security-reglerna.

## Admin

Ga till `/admin.html` pa din publicerade sida.

Du kan:

- skapa sidor
- andra menytext och menyordning
- valja vilka sidor som syns i menyn
- byta text och bilder
- ladda upp bilder till Supabase Storage
- flytta block upp och ned
- byta enkla layoutinstallningar per block

## Lokalt test

Starta en enkel lokal server:

```bash
python3 -m http.server 4173
```

Oppna sedan `http://localhost:4173`.
