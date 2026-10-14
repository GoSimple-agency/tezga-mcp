<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tezga-lockup-dark.svg">
    <img src="assets/tezga-lockup.svg" alt="Tezga eKasa" width="440">
  </picture>
</p>

<h1 align="center">tezga-mcp</h1>

<p align="center">
  <b>Fiskalizacija iz AI alata.</b> MCP server za <b>Tezga eKasa</b>: izdaj i fiskalizuj
  račune preko V-PFR-a Poreske uprave, bez hardvera, direktno iz Claude, Cursor,
  Codex i Claude Code.
  <br>
  <sub>A Model Context Protocol server for Serbian fiscalization (V-PFR, ESIR): issue, refund and advance fiscal receipts from any MCP client.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tezga-mcp"><img src="https://img.shields.io/npm/v/tezga-mcp.svg?label=npm&color=00313e" alt="npm verzija"></a>
  <img src="https://img.shields.io/badge/license-MIT-00313e.svg" alt="Licenca MIT">
  <img src="https://img.shields.io/badge/ESIR-IB%201597-00313e.svg" alt="ESIR IB 1597">
  <a href="https://tezgafiskal.com/api-za-fiskalizaciju"><img src="https://img.shields.io/badge/API-tezgafiskal.com-00313e.svg" alt="Tezga API"></a>
</p>

---

**Tezga** je online fiskalna kasa (ESIR, IB 1597) za Srbiju: fiskalni računi preko virtuelnog procesora fiskalnih računa (V-PFR) Poreske uprave, bez kupovine uređaja. Ovaj paket izlaže Tezgin REST API kao MCP alate, pa asistent (Claude, Cursor, Codex) može da izda račun, uradi storno ili refundaciju, otvori i zatvori avans i proveri stanje dokumenta — iz razgovora ili iz koda.

> Veb: **[tezgafiskal.com](https://tezgafiskal.com)** · API za programere: **[tezgafiskal.com/api-za-fiskalizaciju](https://tezgafiskal.com/api-za-fiskalizaciju)** · OpenAPI: **[pos.narbiz.com/api/openapi.json](https://pos.narbiz.com/api/openapi.json)**

## Tezga eKasa — kompletna fiskalna kasa

- **Fiskalizacija.** Fiskalni računi preko V-PFR-a bez hardvera (i L-PFR za fizički objekat), storno i refundacija (cela ili po stavkama). Radi na telefonu, tabletu i računaru.
- **Avansni računi.** Više avansa po jednom poslu, otvaranje i zatvaranje konačnim računom, sa referencom koju propis traži.
- **E-fakture (SEF).** Fiskalni račun i e-faktura iz istog šifarnika i istog ključa; fizičko lice dobija fiskalni račun, firma e-fakturu.
- **E-otpremnice.** Elektronske otpremnice uz prateći fiskalni tok.
- **Roba i izveštaji.** Količinske zalihe, kalkulacije i nivelacije (paket Biznis), KEP i arhivska knjiga, poklon vaučeri, automatski izveštaji knjigovođi na mejl, uvoz bankovnih izvoda.
- **Više korisnika i firmi.** Uloge administrator, menadžer i kasir; više firmi na jednom nalogu (pogodno za knjigovođe), svaka radnja u dnevniku aktivnosti.
- **Integracije.** REST API (ovaj MCP), dvosmerna veza sa WooCommerce i Shopify, webhook za PrestaShop, OpenCart, Magento i BigCommerce, plus n8n, Make i Zapier.
- **Bezbednost.** Podaci u EU (Frankfurt), šifrovanje AES-256-GCM, dvofaktorska prijava, ograničenje po IP adresi. Bezbednosni element se čuva šifrovan i nikad se ne prikazuje.
- **Sertifikat Poreske uprave.** Odobren ESIR, **IB 1597**, rešenje 000-092-00-00123/2026-0000 od 03.07.2026, verzija 1.1.

> Puna lista funkcija: **[tezgafiskal.com/sve-funkcije-fiskalne-kase](https://tezgafiskal.com/sve-funkcije-fiskalne-kase)**

## Što ovaj MCP izlaže

- **Fiskalni račun i e-faktura (SEF)** iz istog ključa i šifarnika.
- **Storno i refundacija**, cela ili po stavkama, sa vezom na original.
- **Avansni račun**: otvaranje i zatvaranje konačnim računom.
- **Idempotentnost** preko `externalId`: isti broj porudžbine nikad ne pravi drugi račun.
- **Sandbox i simulacija**: proba bez slanja Poreskoj (PFR broj počinje sa `MOCK`).
- **Dva transporta iz istog koda**: lokalni `stdio` i remote `Streamable HTTP`.

## Alati

| Alat | Šta radi |
|---|---|
| `tezga_okruzenje` | Okruženje naloga (produkcija / sandbox / simulacija) i poreske oznake. Pozovi prvo. |
| `tezga_izdaj_racun` | Izdaje i fiskalizuje račun; vraća PFR broj, QR, verifikacioni URL i javni PDF link. |
| `tezga_storno_ili_refundacija` | Storno (ceo račun) ili refundacija (cela ili po stavkama). |
| `tezga_avans` | Avansni račun: otvaranje i zatvaranje. |
| `tezga_stanje_dokumenta` | Fiskalni podaci dokumenta po Tezga ID-ju. |
| `tezga_lista_dokumenata` | Lista dokumenata naloga, sa filterima. |

### Brana za produkciju

`tezga_izdaj_racun`, `tezga_storno_ili_refundacija` i `tezga_avans` u **produkciji** odbijaju rad dok se eksplicitno ne pošalje `potvrdiProdukciju: true`. Tako asistent ne izda pravi fiskalni račun kod Poreske uprave bez namere. U `sandbox` i `simulacija` okruženju brane nema.

## API ključ

Napravi ključ u Tezgi: **Podešavanja → Integracije** (oblik `tzg_` + 48 heks znakova). Za probu koristi nalog u sandbox ili simulaciji — račun ne ide Poreskoj, a PFR broj počinje sa `MOCK`.

## Brzi start (lokalno, stdio)

```bash
npm install
npm run build
TEZGA_API_KEY=tzg_... npm start
```

Ili bez kloniranja, čim paket bude na npm-u:

```bash
TEZGA_API_KEY=tzg_... npx tezga-mcp
```

### Dodavanje u klijente

**Claude Code / Cursor / Codex / Claude Desktop** (`mcp.json`, `claude_desktop_config.json` ili ekvivalent):

```json
{
  "mcpServers": {
    "tezga": {
      "command": "npx",
      "args": ["-y", "tezga-mcp"],
      "env": { "TEZGA_API_KEY": "tzg_..." }
    }
  }
}
```

## Remote konektor (Streamable HTTP)

Za rad kao custom connector koji se dodaje po URL-u:

```bash
npm run build
TEZGA_API_KEY=tzg_... PORT=8787 npm run start:http
# sluša na http://localhost:8787/mcp ; /health za proveru
```

Posle deploy-a, u Claude: **Settings → Connectors → Add custom connector** i zalepi URL. Ključ se šalje kroz zaglavlje `X-Tezga-Api-Key` ili `Authorization: Bearer`.

## Kako radi

MCP server je tanak, proveren omotač oko Tezginog javnog API-ja (`https://pos.narbiz.com/api/integrations`). Validaciju radi API i vraća jasne poruke; server ne drži tajne niti izlaže bezbednosni element, lozinke ili ključeve.

## Bezbednost

- Bezbednosni element, lozinke, PAK i ključevi se **nikad** ne prikazuju kroz MCP.
- U produkciji svaka radnja koja menja stanje traži `potvrdiProdukciju: true`.
- API ključ drži u promenljivoj okruženja, ne u kodu.

## Konfiguracija

| Promenljiva | Podrazumevano | Opis |
|---|---|---|
| `TEZGA_API_KEY` | — | Obavezno. Ključ `tzg_...` iz Podešavanja → Integracije. |
| `TEZGA_BASE_URL` | `https://pos.narbiz.com` | Bazni URL API-ja. |
| `PORT` | `8787` | Samo za remote (`start:http`). |
| `MCP_PATH` | `/mcp` | Putanja remote endpointa. |

## Roadmap

- Hostovani remote konektor sa OAuth 2.1.
- Objava na npm i u MCP registru.

## Podrška

Pitanja i integracije: **podrska@tezgafiskal.com** · [tezgafiskal.com/api-za-fiskalizaciju](https://tezgafiskal.com/api-za-fiskalizaciju)

## Licenca

Vlasnička licenca, [LICENSE](LICENSE). © GoSimple. Dozvoljeno je da ga instaliraš i
pokrećeš radi povezivanja sa Tezgom preko sopstvenog naloga i API ključa.

---

<p align="center">
  <sub>Proizvod <a href="https://gosimple.agency">GoSimple</a> porodice.</sub>
  <br><br>
  <a href="https://gosimple.agency"><img src="assets/gosimple-logo.png" width="130" alt="GoSimple"></a>
</p>
