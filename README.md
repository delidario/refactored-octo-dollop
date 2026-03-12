# Farmacie di Turno — Milano 🗺️

Una mappa interattiva delle farmacie di turno a Milano.
Seleziona il giorno, cerca per indirizzo, o usa la tua posizione GPS per trovare la farmacia più vicina.

---

## Come funziona

1. Ogni giorno alle 06:10 un processo automatico scarica i turni delle farmacie dal sito [farmaciediturno.org](https://www.farmaciediturno.org) e li salva come file di dati nel repository.
2. Il sito web (pubblicato tramite GitHub Pages) legge questi file e mostra i risultati sulla mappa.
3. Non hai bisogno di toccare nulla: una volta configurato, si aggiorna da solo ogni giorno.

---

## Configurazione iniziale (da fare una volta sola)

Segui questi passaggi nell'ordine indicato.

---

### Passo 1 — Ottieni la chiave API gratuita

I dati delle farmacie vengono forniti da **farmaciediturno.org** tramite un'API gratuita.

1. Invia una e-mail a **info@farmaciediturno.org**
2. Indica il tuo nome e che vuoi usare l'API per una mappa personale delle farmacie di turno a Milano
3. Riceverai una chiave (una stringa di testo) via e-mail
4. Conserva questa chiave: ti servirà nel passo successivo

---

### Passo 2 — Aggiungi la chiave API come segreto su GitHub

1. Apri questo repository su GitHub
2. Clicca sulla scheda **Settings** (in alto)
3. Nel menu di sinistra, clicca **Secrets and variables** → **Actions**
4. Clicca il pulsante verde **New repository secret**
5. Nel campo **Name** scrivi esattamente: `FARMACIEDITURNO_API_KEY`
6. Nel campo **Secret** incolla la chiave che hai ricevuto per e-mail
7. Clicca **Add secret**

---

### Passo 3 — Attiva GitHub Pages

1. Apri questo repository su GitHub
2. Clicca sulla scheda **Settings**
3. Nel menu di sinistra, clicca **Pages**
4. Sotto **Source**, seleziona **Deploy from a branch**
5. Seleziona il branch `main` e la cartella `/ (root)`
6. Clicca **Save**
7. Dopo qualche minuto, troverai l'indirizzo del sito nella stessa pagina (es. `https://tuonome.github.io/refactored-octo-dollop/`)

---

### Passo 4 — Esegui il primo aggiornamento manuale

Il processo automatico si avvierà ogni giorno alle 06:10, ma puoi avviarlo subito per vedere subito i dati reali sulla mappa:

1. Apri la scheda **Actions** su GitHub
2. Clicca su **Aggiorna Farmacie di Turno** nella lista a sinistra
3. Clicca il pulsante **Run workflow** → **Run workflow**
4. Attendi 1-2 minuti che il processo finisca (vedrai una spunta verde ✅)
5. Ricarica la pagina del sito: ora vedrai le farmacie di turno reali!

---

## Cosa vedi prima della configurazione

Fino a quando il processo automatico non ha scaricato i dati reali, il sito mostra **dati di esempio** (farmacie fittizie distribuite per Milano) così puoi vedere come funziona l'interfaccia.

---

## Funzionalità

| Funzione | Come si usa |
|---|---|
| **Seleziona il giorno** | Tocca/clicca uno dei pulsanti in alto per vedere le farmacie di turno in quel giorno |
| **Cerca per indirizzo** | Digita un indirizzo o un quartiere (es. "Via Roma 10" o "Navigli") e premi **Cerca** |
| **Vicino a me** | Premi il pulsante "Vicino a me" per usare il GPS e trovare la farmacia più vicina alla tua posizione |
| **Dettagli farmacia** | Clicca su un pin verde sulla mappa per vedere nome, indirizzo, telefono e orari |
| **Raggruppamento** | Se ci sono molte farmacie vicine, i pin vengono raggruppati in un cerchio: toccalo per espandere |

---

## Note importanti

- I dati vengono aggiornati automaticamente ogni giorno alle 06:10.
- **Orari e turni sono soggetti a variazioni**: verifica sempre la bacheca all'esterno della farmacia.
- La mappa mostra le farmacie nei giorni disponibili (tipicamente oggi e i prossimi 1-7 giorni, in base a quanto supporta l'API).
- La funzione "Vicino a me" richiede il permesso di accesso alla posizione nel browser.

---

## Tecnologie usate (tutte gratuite)

- **GitHub Pages** — hosting del sito web
- **GitHub Actions** — aggiornamento automatico dei dati
- **Leaflet.js** — mappa interattiva open-source
- **OpenStreetMap** — mappe gratuite
- **farmaciediturno.org** — dati dei turni delle farmacie
- **Nominatim** — ricerca per indirizzo (OpenStreetMap)
