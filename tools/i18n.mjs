// Per-language settings and blog UI strings. One entry per site language — the same set and order
// as the app (docs/LOCALIZATION.md in the app repo). Home page copy lives in i18n/<lang>.json.
//   path   — URL prefix of the language ("" for English, which lives at the root)
//   hreflang / ogLocale — what search engines and social cards are told
// Add a language: add it here, add i18n/<code>.json, assets/screens/<code>/, blog/faq/<code>.html
// and a translation of every post under blog/posts/<code>/.

export const LANGS = {
  en: {
    path: "", hreflang: "en", ogLocale: "en_US", label: "English",
    blog: "Blog", blogTitle: "Budgeting guides", blogIntro:
      "Practical guides to envelope budgeting, shared household money and keeping track of what you spend — without connecting a bank.",
    readMore: "Read the guide", published: "Published", allPosts: "All guides", home: "Home",
    ctaTitle: "Budget together, envelope by envelope",
    ctaText: "Give every part of your money an envelope, log expenses in seconds and share one budget with your household. No bank login, no sign-up.",
  },
  uk: {
    path: "uk", hreflang: "uk", ogLocale: "uk_UA", label: "Українська",
    blog: "Блог", blogTitle: "Поради про бюджет", blogIntro:
      "Практичні поради про бюджет у конвертах, спільні гроші в родині та облік витрат — без підключення банку.",
    readMore: "Читати", published: "Опубліковано", allPosts: "Усі статті", home: "Головна",
    ctaTitle: "Плануйте бюджет разом, конверт за конвертом",
    ctaText: "Розкладіть гроші по конвертах, записуйте витрати за секунди та ведіть один бюджет усією родиною. Без банківських логінів і реєстрації.",
  },
  hu: {
    path: "hu", hreflang: "hu", ogLocale: "hu_HU", label: "Magyar",
    blog: "Blog", blogTitle: "Költségvetési útmutatók", blogIntro:
      "Gyakorlati útmutatók a borítékos költségvetéshez, a közös családi kasszához és a kiadások követéséhez — banki összekapcsolás nélkül.",
    readMore: "Elolvasom", published: "Megjelent:", allPosts: "Összes útmutató", home: "Főoldal",
    ctaTitle: "Közös költségvetés, borítékról borítékra",
    ctaText: "Adj minden forintnak borítékot, rögzítsd a kiadásokat másodpercek alatt, és vezessétek együtt a családi költségvetést. Banki belépés és regisztráció nélkül.",
  },
  nb: {
    path: "nb", hreflang: "nb", ogLocale: "nb_NO", label: "Norsk",
    blog: "Blogg", blogTitle: "Budsjettguider", blogIntro:
      "Praktiske guider til konvoluttbudsjett, felles økonomi i husholdningen og oversikt over forbruket — uten å koble til banken.",
    readMore: "Les guiden", published: "Publisert", allPosts: "Alle guider", home: "Hjem",
    ctaTitle: "Budsjetter sammen, konvolutt for konvolutt",
    ctaText: "Gi pengene hver sin konvolutt, registrer utgifter på sekunder og del ett budsjett med hele husstanden. Ingen bankinnlogging, ingen registrering.",
  },
  de: {
    path: "de", hreflang: "de", ogLocale: "de_DE", label: "Deutsch",
    blog: "Blog", blogTitle: "Budget-Ratgeber", blogIntro:
      "Praktische Ratgeber zur Umschlagmethode, zum gemeinsamen Haushaltsbudget und zum Überblick über eure Ausgaben — ganz ohne Bankverbindung.",
    readMore: "Ratgeber lesen", published: "Veröffentlicht am", allPosts: "Alle Ratgeber", home: "Startseite",
    ctaTitle: "Gemeinsam budgetieren, Umschlag für Umschlag",
    ctaText: "Gib deinem Geld Umschläge, erfasse Ausgaben in Sekunden und teile ein Budget mit dem ganzen Haushalt. Kein Bank-Login, keine Anmeldung.",
  },
  fr: {
    path: "fr", hreflang: "fr", ogLocale: "fr_FR", label: "Français",
    blog: "Blog", blogTitle: "Guides budget", blogIntro:
      "Des guides pratiques sur le budget par enveloppes, l’argent du foyer et le suivi des dépenses — sans connexion bancaire.",
    readMore: "Lire le guide", published: "Publié le", allPosts: "Tous les guides", home: "Accueil",
    ctaTitle: "Gérez votre budget ensemble, enveloppe par enveloppe",
    ctaText: "Répartissez votre argent en enveloppes, notez vos dépenses en quelques secondes et partagez un seul budget avec tout le foyer. Sans connexion bancaire ni inscription.",
  },
  pt: {
    path: "pt", hreflang: "pt", ogLocale: "pt_BR", label: "Português",
    blog: "Blog", blogTitle: "Guias de orçamento", blogIntro:
      "Guias práticos sobre orçamento em envelopes, dinheiro da casa e controle de gastos — sem conectar o banco.",
    readMore: "Ler o guia", published: "Publicado em", allPosts: "Todos os guias", home: "Início",
    ctaTitle: "Orçamento em família, envelope por envelope",
    ctaText: "Divida seu dinheiro em envelopes, registre gastos em segundos e compartilhe um só orçamento com toda a casa. Sem login de banco, sem cadastro.",
  },
  es: {
    path: "es", hreflang: "es", ogLocale: "es_ES", label: "Español",
    blog: "Blog", blogTitle: "Guías de presupuesto", blogIntro:
      "Guías prácticas sobre el presupuesto por sobres, el dinero del hogar y el control de gastos, sin conectar tu banco.",
    readMore: "Leer la guía", published: "Publicado el", allPosts: "Todas las guías", home: "Inicio",
    ctaTitle: "Presupuesto en familia, sobre a sobre",
    ctaText: "Reparte tu dinero en sobres, registra gastos en segundos y comparte un solo presupuesto con toda la familia. Sin conectar tu banco y sin registrarte.",
  },
};

/** "/" for English, "/de/" etc. for the rest. */
export const homeURL = (code) => (LANGS[code].path ? `/${LANGS[code].path}/` : "/");
/** "/blog/" for English, "/de/blog/" etc. */
export const blogURL = (code) => `${homeURL(code)}blog/`;
