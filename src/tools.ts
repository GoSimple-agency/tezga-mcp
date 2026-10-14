import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TezgaKlijent, TezgaGreska } from "./api.js";

// Jedan izvor alata za oba transporta (stdio i remote HTTP). Alati su tanki
// omotači oko Tezga API-ja. Fiskalno je osetljivo, pa izdavanje/refundacija
// imaju branu: u PRODUKCIJI zahtevaju eksplicitno potvrdiProdukciju=true, da
// agent ne izda pravi račun kod Poreske uprave bez namere.

type Sadrzaj = { content: { type: "text"; text: string }[]; isError?: boolean };

function tekst(data: unknown): Sadrzaj {
  const s = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text: s }] };
}

function greska(poruka: string): Sadrzaj {
  return { content: [{ type: "text", text: poruka }], isError: true };
}

async function branaProdukcije(
  klijent: TezgaKlijent,
  potvrdiProdukciju: boolean | undefined,
): Promise<Sadrzaj | null> {
  const okr = await klijent.okruzenje();
  if (okr === "produkcija" && !potvrdiProdukciju) {
    return greska(
      "Nalog je u PRODUKCIJI: ovo bi izdalo PRAVI fiskalni račun kod Poreske uprave. " +
        "Ako to zaista želiš, ponovi poziv sa potvrdiProdukciju=true. " +
        "Za probu koristi nalog u sandbox ili simulacija okruženju (vidi tezga_okruzenje).",
    );
  }
  return null;
}

export function registrujAlate(server: McpServer, klijent: TezgaKlijent): void {
  const stavkaShape = z
    .object({
      naziv: z.string().describe("Naziv stavke na računu"),
      kolicina: z.number().describe("Količina"),
      cenaSaPdv: z.number().describe("Jedinična cena sa PDV-om, u dinarima"),
      poreskaStopa: z
        .union([z.number(), z.string()])
        .optional()
        .describe("20, 10, 0 ili pdv20/pdv10/oslobodjeno; prazno = 20%"),
      sifra: z.string().optional().describe("Šifra artikla iz Tezga kataloga"),
      jedinicaMere: z.string().optional(),
      popustProcenat: z.number().optional(),
      popustRsd: z.number().optional(),
    })
    .passthrough();

  // 1. Okruženje (read-only) — agent prvo proveri da li radi u produkciji.
  server.registerTool(
    "tezga_okruzenje",
    {
      title: "Okruženje i poreske oznake",
      description:
        "Vraća okruženje naloga (produkcija, sandbox ili simulacija) i poreske oznake. " +
        "Pozovi OVO prvo da znaš da li bi izdavanje računa napravilo pravi račun kod Poreske uprave.",
      inputSchema: {},
    },
    async () => {
      try {
        return tekst(await klijent.poreskeOznake());
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );

  // 2. Izdaj račun.
  server.registerTool(
    "tezga_izdaj_racun",
    {
      title: "Izdaj fiskalni račun",
      description:
        "Izdaje i fiskalizuje račun preko V-PFR-a i vraća PFR broj, QR, verifikacioni URL i javni PDF link. " +
        "Idempotentno: isti externalId nikad ne pravi drugi račun. U produkciji traži potvrdiProdukciju=true.",
      inputSchema: {
        externalId: z
          .string()
          .describe("Tvoj jedinstven broj porudžbine (idempotentnost)"),
        stavke: z.array(stavkaShape).min(1).describe("Stavke računa (do 500)"),
        nacinPlacanja: z
          .string()
          .optional()
          .describe("npr. Kartica, Gotovina, Instant, Prenos na račun, Ček, Vaučer"),
        tok: z
          .enum(["fiskalni", "fiskalni_i_sef", "sef", "avans", "predracun"])
          .optional()
          .describe("Podrazumevano fiskalni"),
        kupac: z
          .record(z.any())
          .optional()
          .describe("Kupac: { naziv, email?, pib?, ... }. Sa pib postaje B2B."),
        posaljiMejl: z
          .boolean()
          .optional()
          .describe("Ako true i ima kupac.email, Tezga šalje račun kupcu"),
        popustProcenat: z.number().optional(),
        popustRsd: z.number().optional(),
        datumUplate: z.string().optional(),
        potvrdiProdukciju: z
          .boolean()
          .optional()
          .describe("Mora biti true da bi se izdao PRAVI račun u produkciji"),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      try {
        const brana = await branaProdukcije(klijent, args.potvrdiProdukciju);
        if (brana) return brana;
        const { potvrdiProdukciju: _p, ...telo } = args;
        return tekst(await klijent.izdajRacun(telo as Record<string, unknown>));
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );

  // 3. Storno ili refundacija.
  server.registerTool(
    "tezga_storno_ili_refundacija",
    {
      title: "Storno ili refundacija",
      description:
        "vrsta=storno poništava ceo račun (pogrešno izdat, bez podataka kupca). " +
        "vrsta=refundacija vraća novac, celu ili po stavkama. Original se nalazi po documentId ili po externalId. " +
        "U produkciji traži potvrdiProdukciju=true.",
      inputSchema: {
        vrsta: z.enum(["storno", "refundacija"]),
        documentId: z.string().optional().describe("Tezga ID originalnog dokumenta"),
        externalId: z.string().optional().describe("Tvoj broj porudžbine originala"),
        razlog: z.string().optional(),
        stavke: z
          .array(z.record(z.any()))
          .optional()
          .describe("Za delimičnu refundaciju: stavke sa količinom"),
        kupacIdBroj: z.string().optional().describe("Samo kad se vraća gotovina"),
        kupacIdTip: z.string().optional(),
        potvrdiProdukciju: z.boolean().optional(),
      },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      try {
        if (!args.documentId && !args.externalId) {
          return greska("Navedi documentId ili externalId originalnog računa.");
        }
        const brana = await branaProdukcije(klijent, args.potvrdiProdukciju);
        if (brana) return brana;
        const { potvrdiProdukciju: _p, ...telo } = args;
        return tekst(await klijent.stornoIliRefundacija(telo as Record<string, unknown>));
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );

  // 4. Avans (otvaranje i zatvaranje) — telo se prosleđuje, šema je fleksibilna.
  server.registerTool(
    "tezga_avans",
    {
      title: "Avansni račun (otvaranje i zatvaranje)",
      description:
        "Otvara avansni račun (iznos, datumUplate, stopa, kupac). Sa zatvori=true i stvarnim stavkama " +
        "izdaje refundaciju avansa pa konačni račun. U produkciji traži potvrdiProdukciju=true.",
      inputSchema: {
        telo: z
          .record(z.any())
          .describe(
            "Telo zahteva po OpenAPI /advance: npr. { externalId, iznos, datumUplate, poreskaStopa, kupac } ili { externalId, zatvori: true, stavke }",
          ),
        potvrdiProdukciju: z.boolean().optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (args) => {
      try {
        const brana = await branaProdukcije(klijent, args.potvrdiProdukciju);
        if (brana) return brana;
        return tekst(await klijent.avans(args.telo as Record<string, unknown>));
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );

  // 5. Stanje dokumenta (read-only).
  server.registerTool(
    "tezga_stanje_dokumenta",
    {
      title: "Stanje dokumenta",
      description:
        "Vraća sve fiskalne podatke dokumenta (PFR broj, verifikacioni URL, status) po Tezga ID-ju.",
      inputSchema: { id: z.string().describe("Tezga documentId") },
    },
    async (args) => {
      try {
        return tekst(await klijent.stanjeDokumenta(args.id));
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );

  // 6. Lista dokumenata (read-only).
  server.registerTool(
    "tezga_lista_dokumenata",
    {
      title: "Lista dokumenata",
      description:
        "Lista fiskalnih dokumenata naloga, sa opcionim filterima (prosleđuju se kao query parametri).",
      inputSchema: {
        filteri: z
          .record(z.string())
          .optional()
          .describe("Opcioni filteri, npr. { od, do, status }"),
      },
    },
    async (args) => {
      try {
        return tekst(await klijent.listaDokumenata(args.filteri ?? {}));
      } catch (e) {
        return greska(opisGreske(e));
      }
    },
  );
}

function opisGreske(e: unknown): string {
  if (e instanceof TezgaGreska) {
    return `Tezga API greška ${e.status}: ${e.message}\n${JSON.stringify(e.telo, null, 2)}`;
  }
  return e instanceof Error ? e.message : String(e);
}
