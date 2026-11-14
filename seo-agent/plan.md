# Content plan — the map the daily agent works from

The site has three kinds of pages, and each answers a different search:

| Kind | Answers | Example search | Lives in |
|---|---|---|---|
| **Home page** | the brand + the head commercial term of the language | "Haushaltsbuch App", "budget app for couples" | `i18n/<lang>.json`, tuned via `blog/home/<lang>.json` |
| **Service page** | "I want an app that does X" (commercial intent) | "haushaltsbuch app ohne kontoanbindung", "application budget couple" | `blog/pages/<lang>/<slug>.md` → `/<lang>/<slug>/` |
| **Guide** (blog post) | "how do I do X" (informational intent) | "how to budget as a couple", "Umschlagmethode Kategorien" | `blog/posts/<lang>/<slug>.md` → `/<lang>/blog/<slug>/` |

Every guide belongs to one **cluster** (front matter `cluster:` = a service page key). The build links
each guide to its cluster's service page and to its neighbours ("Read next"), and the home page links
to every service page. So a guide passes its relevance up to the service page, and the service page
up to the home page. Don't target the same main keyword with two pages in one language — the
validator refuses it.

## Service pages — build them in this order

A row is built once its key appears under "Service pages" in the daily brief. The keywords are starting points seen in
autocomplete on 2026-11-14; check them against the day's brief and write each language natively.

| # | key | Angle (only FACTS.md claims) | en | de | fr | es | pt | hu | nb | uk |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `couples-budget-app` | one shared budget for two, both log, both see it; joining is free | budget app for couples | Haushaltsbuch App für Paare | application budget couple | app para presupuesto en pareja | aplicativo de controle de gastos para casal | közös költségvetés app pároknak | budsjett app for par | додаток для спільного бюджету пари |
| 2 | `family-budget-app` | the whole household in one space, kids/grandparents by name, who spent what | family budget app | Haushaltsbuch App Familie | application budget familial | app de presupuesto familiar | app orçamento familiar | családi költségvetés app | familiebudsjett app | додаток для сімейного бюджету |
| 3 | `expense-tracker-no-bank` | manual logging, no bank login, no account, works offline, data stays on the phone | budget app without bank connection | Haushaltsbuch App ohne Kontoanbindung | application budget sans connexion bancaire | app control de gastos sin conectar el banco | aplicativo de controle de gastos sem conectar banco | költségvetés app bankkapcsolat nélkül | budsjett app uten bankkobling | облік витрат без підключення банку |
| 4 | `envelope-budgeting-app` | the envelope method on the phone: envelopes, budgets per envelope, month from payday | envelope budgeting app | Umschlagmethode App | application budget enveloppes | app método de los sobres | app método dos envelopes | borítékos módszer app | konvoluttbudsjett app | додаток метод конвертів |
| 5 | `travel-budget-app` | a separate space for a trip with its own currency and members; *not* a who-owes-whom splitter | travel budget app | Reisekasse App | application budget voyage | app control de gastos de viaje | aplicativo para gastos de viagem | utazási költségvetés app | reisebudsjett app | бюджет подорожі додаток |
| 6 | `shared-expense-tracker` | flat-share / shared household spending in one space, insights per person | shared expense tracker app | gemeinsame Ausgaben App | application dépenses partagées | app gastos compartidos | app gastos compartilhados | közös kiadások app | app for felles utgifter | спільні витрати додаток |
| 7 | `multi-currency-budget` | Premium: log in the currency you paid, kept as typed, listed separately (no conversion) | multi currency budget app | Budget App mehrere Währungen | application budget multi-devises | app presupuesto varias monedas | app orçamento várias moedas | több pénznemes költségvetés app | budsjett app flere valutaer | бюджет у кількох валютах додаток |

Existing guides and their cluster: `envelope-budgeting-couples` → `couples-budget-app`,
`family-budget` → `family-budget-app`, `envelope-budgeting-pros-cons` → `envelope-budgeting-app`.

## Guide ideas per cluster (pick the one the brief supports best)

- **couples-budget-app:** joint vs separate accounts and one budget · how to talk about money as a couple · proportional contributions to shared costs (by hand) · budgeting when moving in together
- **family-budget-app:** household budget categories list · how much to budget for groceries per person · budgeting with kids (pocket money envelopes) · yearly costs envelope (Nebenkosten, rezsi, комуналка…)
- **expense-tracker-no-bank:** how to track expenses by hand · expense tracker template vs app · tracking cash spending · weekly money check-in routine
- **envelope-budgeting-app:** envelope budgeting categories · digital vs cash envelopes · what to do when an envelope runs out · budget month that starts on payday
- **travel-budget-app:** how to budget for a holiday · holiday spending in another currency (no conversion claims) · group trip budget without arguments
- **shared-expense-tracker:** flat-share budget rules · household chores & money (light) · shared groceries
- **multi-currency-budget:** living in one currency, earning in another · cross-border families

## Home page targets (first tuning)

The home page should carry the language's head commercial term in the `<title>`, the H1 or tagline,
and the meta description — naturally, once each. Suggested from the 2026-11-14 commercial
autocomplete; confirm with the brief and Search Console before tuning:

- en: budget app for couples · family budget app · envelope budgeting app
- de: Haushaltsbuch App · Haushaltsbuch App für Paare · Budget App
- fr: application budget · application budget couple · application budget familial
- es: app de presupuesto familiar · app control de gastos · app para presupuesto en pareja
- pt: aplicativo de controle de gastos · app orçamento familiar · aplicativo para casal
- hu: költségvetés app · családi költségvetés app
- nb: budsjett app · budsjett app for par · familiebudsjett app
- uk: додаток для сімейного бюджету · облік витрат додаток · програма для сімейного бюджету
