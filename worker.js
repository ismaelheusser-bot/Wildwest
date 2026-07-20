/* Dusty Gulch – Bestenliste
   Cloudflare Worker mit KV-Speicher.
   Einrichtung:
   1. cloudflare.com – kostenloses Konto
   2. Storage & Databases → KV → Create → Name: BESTENLISTE
   3. Compute → Workers → Create → Hello World → diesen Code einfügen → Deploy
   4. Worker → Settings → Bindings → Add → KV namespace
      Variable name: SCORES     KV namespace: BESTENLISTE
   5. Die Adresse des Workers (…​.workers.dev) unten in ERLAUBT eintragen? Nein –
      dort steht die Adresse DEINER SEITE. Die Worker-Adresse kommt in die Arcade.
*/

const ERLAUBT = [
  "https://ismaelheusser-bot.github.io"
  // hier später eine eigene Domain ergänzen
];

const SPIELE = {
  jagd:  { kleinerIstBesser: false, max: 1000000 },
  ritt:  { kleinerIstBesser: false, max: 200000 },
  duell: { kleinerIstBesser: true,  max: 5000 }
   
};

export default {
  async fetch(request, env) {
    const herkunft = request.headers.get("Origin") || "";
    const kopf = {
      "Access-Control-Allow-Origin": ERLAUBT.includes(herkunft) ? herkunft : ERLAUBT[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: kopf });

    const url = new URL(request.url);
    const spiel = (url.searchParams.get("spiel") || "").toLowerCase();
    const regel = SPIELE[spiel];
    if (!regel) return antwort({ fehler: "Unbekanntes Spiel" }, 400, kopf);

    const schluessel = "top:" + spiel;

    if (request.method === "GET") {
      const liste = JSON.parse((await env.SCORES.get(schluessel)) || "[]");
      return antwort(liste, 200, kopf);
    }

    if (request.method === "POST") {
      let daten;
      try { daten = await request.json(); }
      catch (e) { return antwort({ fehler: "Ungültige Daten" }, 400, kopf); }

      const name = String(daten.name || "")
        .replace(/[^\p{L}\p{N} .\-_]/gu, "")
        .trim().slice(0, 16) || "Fremder";

      const punkte = Math.round(Number(daten.punkte));
      if (!Number.isFinite(punkte) || punkte < 0 || punkte > regel.max)
        return antwort({ fehler: "Unplausible Punktzahl" }, 400, kopf);

      const liste = JSON.parse((await env.SCORES.get(schluessel)) || "[]");
      liste.push({ name, punkte, datum: Date.now() });
      liste.sort((a, b) => regel.kleinerIstBesser ? a.punkte - b.punkte : b.punkte - a.punkte);

      // pro Name nur der beste Eintrag, dann auf 20 kürzen
      const gesehen = new Set();
      const kurz = liste.filter(e => {
        const k = e.name.toLowerCase();
        if (gesehen.has(k)) return false;
        gesehen.add(k); return true;
      }).slice(0, 20);

      await env.SCORES.put(schluessel, JSON.stringify(kurz));
      return antwort(kurz, 200, kopf);
    }

    return antwort({ fehler: "Methode nicht erlaubt" }, 405, kopf);
  }
};

function antwort(daten, status, kopf) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { ...kopf, "Content-Type": "application/json; charset=utf-8" }
  });
}
