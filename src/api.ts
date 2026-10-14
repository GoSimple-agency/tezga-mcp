// Tanak klijent za Tezga javni API (https://pos.narbiz.com/api/integrations).
// MCP server je samo omotač: autentikacija ide ključem X-Tezga-Api-Key, a telo
// se prosleđuje API-ju koji validira i vraća jasne 4xx poruke. Namerno ne
// dupliramo validaciju da se MCP ne raziđe sa API-jem kad se on promeni.

export const PODRAZUMEVANI_BAZNI_URL = "https://pos.narbiz.com";

export type Okruzenje = "produkcija" | "sandbox" | "simulacija" | "nepoznato";

export class TezgaGreska extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly telo: unknown,
  ) {
    super(message);
    this.name = "TezgaGreska";
  }
}

export interface TezgaKlijentOpcije {
  apiKljuc: string;
  bazniUrl?: string;
}

export class TezgaKlijent {
  private readonly apiKljuc: string;
  private readonly bazniUrl: string;

  constructor(opcije: TezgaKlijentOpcije) {
    // Namerno ne bacamo ako ključ fali: server se podigne, a prvi poziv alata
    // vrati jasnu poruku (bolje iskustvo u MCP klijentu od pada pri startu).
    this.apiKljuc = opcije.apiKljuc ?? "";
    this.bazniUrl = (opcije.bazniUrl ?? PODRAZUMEVANI_BAZNI_URL).replace(/\/$/, "");
  }

  private async zahtev(
    metod: "GET" | "POST",
    putanja: string,
    telo?: unknown,
  ): Promise<unknown> {
    if (!this.apiKljuc) {
      throw new TezgaGreska(
        "Nedostaje Tezga API ključ. Postavi TEZGA_API_KEY (oblik tzg_...) ili pošalji zaglavlje X-Tezga-Api-Key.",
        401,
        null,
      );
    }
    const odgovor = await fetch(`${this.bazniUrl}/api/integrations${putanja}`, {
      method: metod,
      headers: {
        "X-Tezga-Api-Key": this.apiKljuc,
        ...(telo ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
      },
      body: telo ? JSON.stringify(telo) : undefined,
    });

    const tekst = await odgovor.text();
    let podaci: unknown = tekst;
    try {
      podaci = tekst ? JSON.parse(tekst) : null;
    } catch {
      // Neki odgovori (npr. PDF link) nisu JSON; ostavljamo tekst.
    }

    if (!odgovor.ok) {
      // Telo greške API-ja je { error, fields[] }. (Starije verzije su koristile
      // `poruka`, pa je zadržavamo kao rezervu da poruka nikad ne izostane.)
      let poruka = `Tezga API ${odgovor.status}`;
      if (podaci && typeof podaci === "object") {
        const d = podaci as { error?: unknown; poruka?: unknown };
        const m =
          typeof d.error === "string" && d.error
            ? d.error
            : typeof d.poruka === "string" && d.poruka
              ? d.poruka
              : "";
        if (m) poruka = m;
      }
      throw new TezgaGreska(poruka, odgovor.status, podaci);
    }
    return podaci;
  }

  izdajRacun(telo: Record<string, unknown>, provider = "custom") {
    return this.zahtev("POST", `/order?provider=${encodeURIComponent(provider)}`, telo);
  }

  stornoIliRefundacija(telo: Record<string, unknown>) {
    return this.zahtev("POST", "/refund", telo);
  }

  avans(telo: Record<string, unknown>) {
    return this.zahtev("POST", "/advance", telo);
  }

  stanjeDokumenta(id: string) {
    return this.zahtev("GET", `/documents/${encodeURIComponent(id)}`);
  }

  listaDokumenata(upit: Record<string, string> = {}) {
    const qs = new URLSearchParams(upit).toString();
    return this.zahtev("GET", `/documents${qs ? `?${qs}` : ""}`);
  }

  poreskeOznake() {
    return this.zahtev("GET", "/tax-labels");
  }

  async okruzenje(): Promise<Okruzenje> {
    const oznake = (await this.poreskeOznake()) as { okruzenje?: string } | null;
    const v = oznake?.okruzenje;
    if (v === "produkcija" || v === "sandbox" || v === "simulacija") return v;
    return "nepoznato";
  }
}
