# Min hemsida

En enkel statisk hemsida som kan publiceras gratis via GitHub och Vercel for ett personligt projekt.

## Filer

- `index.html` - sidans innehall
- `styles.css` - design och responsiv layout
- `script.js` - liten interaktion

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
4. Vercel hittar automatiskt att detta ar en statisk sida. Lamna build command tomt och public directory som `.` om Vercel fragar.

## Supabase som nasta steg

Anvand Supabase nar sidan ska spara data, till exempel kontaktformular, nyhetsbrev, inloggning eller ett enkelt adminlage.

Lagg aldrig hemliga nycklar i GitHub. For en publik statisk sida ska bara Supabase-projektets publika URL och publishable/anon key anvandas i webblasaren. Sakerheten ska sitta i Row Level Security-regler i databasen.

Ett vanligt nasta steg ar:

1. Skapa ett gratis Supabase-projekt.
2. Skapa en tabell for kontaktmeddelanden.
3. Aktivera Row Level Security.
4. Lagg till en INSERT-policy for publika meddelanden, men ingen SELECT-policy for publika besokare.
5. Byt kontaktformularet fran `mailto:` till ett Supabase-anrop.

## Lokalt test

Eftersom sidan ar statisk kan du oppna `index.html` direkt i webblasaren.
