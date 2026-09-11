# Sådan lægger du ClouterX på din Simply-server

Du skifter frem og tilbage mellem to steder. Hvert trin herunder siger tydeligt
hvor du er:

- 🌐 **I BROWSEREN** — Simply's kontrolpanel på simply.com
- ⌨️ **I TERMINAL** — programmet Terminal på din Mac

Åbn Terminal sådan her: tryk **⌘ + Mellemrum**, skriv `terminal`, tryk **Retur**.
Der kommer et vindue med noget tekst og en blinkende markør. Det er alt.

Fem ting det er rart at vide om Terminal, før du går i gang:

1. Du skriver én linje og trykker **Retur**. Så sker der noget.
2. **Når du skriver en adgangskode, kan du ikke se den.** Der sker ingenting på
   skærmen — ingen prikker, ingenting. Det er med vilje. Skriv den alligevel og
   tryk Retur.
3. Du kan copy-paste ind i Terminal med **⌘V**, ligesom alle andre steder.
4. Er markøren tilbage og klar, er kommandoen færdig.
5. Går noget galt, kan du altid lukke vinduet og starte forfra. Du kan ikke
   ødelægge din Mac med det her.

---

# DEL 1 🌐 I BROWSEREN — find tre oplysninger

Gå ind på **simply.com** og log ind. Klik ind på dit domæne. Find menupunktet
**SFTP/FTP**.

Skriv de her tre ting ned på et stykke papir:

| | Ser typisk sådan ud |
|---|---|
| **Host** | `ssh.simply.com` |
| **Brugernavn** | `s123456` (dit kundenummer) |
| **Adgangskode** | den du selv har sat |

Find også ud af hvad din **webrod** hedder. Det er den mappe, hvis indhold
vises når nogen besøger dit domæne. Hos Simply hedder den næsten altid
`public_html`.

> Herfra bruger jeg **BRUGERNAVN** i alle kommandoer. Hver gang du ser det,
> skal du skrive dit eget i stedet — altså fx `s123456`.

---

# DEL 2 ⌨️ I TERMINAL — tag en sikkerhedskopi

Du sletter alt på serveren om lidt, og det kan ikke fortrydes. Så vi henter en
kopi ned på dit skrivebord først.

**Kopier de her tre linjer ind i Terminal, én ad gangen, med Retur imellem:**

```bash
cd ~/Desktop
mkdir clouterx-backup
cd clouterx-backup
```

Der sker ikke noget synligt. Det er rigtigt. Nu skriver du:

```bash
sftp BRUGERNAVN@ssh.simply.com
```

Første gang spørger den måske `Are you sure you want to continue connecting?`
— skriv `yes` og tryk Retur.

Så spørger den om din adgangskode. **Husk: du kan ikke se den mens du skriver.**
Skriv den, tryk Retur.

Nu ser markøren anderledes ud. Der står:

```
sftp>
```

**Det betyder at du nu står inde på serveren.** Kommandoerne her er andre end
før. Skriv:

```
get -r public_html
```

Nu henter den hele siden ned. Det tager et øjeblik, og der løber filnavne over
skærmen. Vent til `sftp>` kommer tilbage. Så skriver du:

```
bye
```

Det lukker forbindelsen, og du er tilbage i almindelig Terminal.

**Tjek at det virkede:** åbn Finder, gå til Skrivebord → `clouterx-backup`.
Der skal ligge en mappe `public_html` med dit gamle site i. Ligger den der ikke,
så gå ikke videre — skriv til mig i stedet.

---

# DEL 3 🌐 I BROWSEREN — slet alt på serveren

Det her gør vi i browseren og ikke i Terminal, fordi du skal kunne **se** hvad
der forsvinder.

1. Gå tilbage til Simply's kontrolpanel
2. Klik på dit domæne
3. Find **Filhåndtering** (den hedder måske "File Manager")
4. Dobbeltklik ind i mappen **`public_html`**
5. Markér alt der ligger derinde
6. Klik **Slet**

⚠️ **Vigtigt:** du skal slette *indholdet* i `public_html`, ikke mappen selv.
Mappen skal blive liggende — bare tom.

---

# DEL 4 ⌨️ I TERMINAL — hent spillet og læg det op

Tilbage i Terminal. Først henter vi spillet ned på din Mac:

```bash
cd ~/Desktop
git clone https://github.com/emilbundsgaard-crypto/rack-and-ruin.git clouterx
cd clouterx
```

> Siger den `git: command not found`? Så popper macOS et vindue op og tilbyder
> at installere nogle udviklerværktøjer. Klik **Installer**, vent til den er
> færdig (et par minutter), og kør så de tre linjer igen.

Nu ligger spillet i en mappe der hedder `clouterx` på dit skrivebord.
Så lægger vi det op:

```bash
./tools/deploy.sh BRUGERNAVN@ssh.simply.com public_html
```

Den spørger om din adgangskode igen (som stadig er usynlig). Så kører den, og
du ser filnavne løbe over skærmen. Når der står **`Done.`** er den færdig.

Scriptet lægger de 20 filer op som siden har brug for, og laver selv de mapper
der skal være. Det sletter aldrig noget — det klarede du i Del 3.

---

# DEL 5 🌐 I BROWSEREN — se om det virker

Skriv dit domæne i adresselinjen. Du skulle gerne se ClouterX-titelskærmen.

**Ser du stadig det gamle site?** Det er din browsers cache. Tryk **⇧⌘R** for
en hård genindlæsning, eller åbn siden i et privat vindue.

---

# Hvis noget går galt

**Siden er helt blank.**
Næsten altid fordi serveren sender spillets filer med den forkerte type.
Uploadscriptet lægger allerede en rettelse op automatisk. Er den stadig blank,
så skriv til mig hvad der står i browserens konsol (⌥⌘I).

**`Permission denied` da du prøvede at uploade.**
Forkert brugernavn eller adgangskode. Prøv at logge ind alene med
`sftp BRUGERNAVN@ssh.simply.com` og se om det overhovedet lykkes.

**`No such file or directory` med `public_html`.**
Din webrod hedder noget andet. Log ind med `sftp BRUGERNAVN@ssh.simply.com`,
skriv `ls`, og se hvad mapperne rent faktisk hedder. Brug det navn i stedet.

**Du har uploadet, men ser stadig den gamle version.**
Din browser gemmer filerne. Åbn Menu i spillet: nederst står `Build ...`. Er
det ikke den nyeste, holder browseren på en gammel kopi — genindlæs med
⇧⌘R, eller åbn siden i et privat vindue. Nyere versioner beder selv browseren
om ikke at gemme filerne, så det her rammer kun én gang.

**Du er faret vild i Terminal.**
Skriv `cd ~/Desktop/clouterx` og tryk Retur. Så står du det rigtige sted igen.

---

# Bagefter: slå HTTPS til

I Simply's kontrolpanel under dit domæne er der et punkt der hedder **SSL**.
Slå det gratis Let's Encrypt-certifikat til. Spillet virker uden, men browsere
er efterhånden sure på almindelig HTTP, og lyden kræver det i nogle af dem.

---

# Når du senere vil opdatere spillet

To linjer i Terminal:

```bash
cd ~/Desktop/clouterx && git pull
./tools/deploy.sh BRUGERNAVN@ssh.simply.com public_html
```

Du skal ikke slette noget først — den skriver bare hen over. Og spillernes
gemte spil ligger i deres egen browser, så en opdatering rører dem aldrig.

---

# Helt uden Terminal

Vil du hellere slippe for Terminal:

1. Gå til [repoet på GitHub](https://github.com/emilbundsgaard-crypto/rack-and-ruin)
2. Klik den grønne **Code**-knap → **Download ZIP**
3. Dobbeltklik ZIP-filen så den pakkes ud
4. I Simply's **Filhåndtering**: upload `index.html`, `privatliv.html`, mappen
   `src`, mappen `styles` og mappen `api` ind i `public_html`

Mapperne `docs` og `tools` skal ikke med — de bruges ikke af siden.

`api`-mappen er live-tælleren og statistikpanelet. Den følger ikke med i ZIP'en
fra GitHub med din adgangskode i — den ligger med vilje ikke i repoet. Er
`api/config.php` ikke med, så omdøb `api/config.example.php` til
`api/config.php` og skriv din egen adgangskode ind i den. Panelet nægter at
åbne, så længe der står `change-me`.

Lav til sidst en fil i `public_html` der hedder `.htaccess` med præcis denne
ene linje i:

```apache
AddType text/javascript .js
```

Uden den er der en risiko for at siden bare er blank.
