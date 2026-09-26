/**
 * Text of the static /about/ page in each interface language
 * (English at about/, Swedish at about/sv/, German at about/de/).
 * Anatomical names come from src/i18n/anatomy.ts and descriptions from src/content/<lang>/.
 */
import type { Lang } from '../i18n/lang.ts';

export interface AboutText {
  htmlLang: string;
  title: string;
  description: string;
  openExplorer: string;
  h1: string;
  lede: string;
  toc: [string, string, string, string, string, string, string];
  onThisPage: string;
  featuresTitle: string;
  features: [string, string][];
  teethTitle: string;
  teethIntro: string;
  quadrants: [string, string, string, string];
  numberingTitle: string;
  numberingIntro: string;
  numberingHead: [string, string, string];
  numberingRows: [string, string, string][];
  typesTitle: string;
  typesIntro: string;
  upper: string;
  lower: string;
  functionLabel: string;
  notesLabel: string;
  rootsLabel: string;
  canalsLabel: string;
  eruptionLabel: string;
  viewIn3d: string;
  glossaryTitle: string;
  glossaryIntro: string;
  glossaryGroups: [string, string, string, string, string, string];
  /** term names where the automatic one (from the content key) does not fit */
  termNames: Record<string, string>;
  faqTitle: string;
  faq: { q: string; a: string }[];
  creditsTitle: string;
  /** credits paragraph as HTML; {author}, {repo}, {bp3d} and {licence} are link placeholders */
  creditsHtml: string;
  note: string;
  footer: string;
  madeBy: string;
  otherLanguages: string;
}

const en: AboutText = {
  htmlLang: 'en',
  title: 'About Dental Scope: Free Interactive 3D Dental Anatomy Atlas',
  description:
    'A free, open-source 3D tooth atlas for dental students: every permanent tooth, tooth numbering systems, tooth tissues, jaws, nerves and muscles, explained.',
  openExplorer: 'Open the 3D explorer →',
  h1: 'Dental Scope: free interactive 3D dental anatomy',
  lede: 'Dental Scope is a free, open-source 3D dental anatomy explorer. Rotate a full skull and both jaws, pick any of the 32 permanent teeth, and dissect a tooth layer by layer, from enamel and dentin down to the pulp and root canals. It runs in the browser with nothing to install.',
  toc: ['Features', 'All 32 teeth', 'Tooth numbering', 'Tooth types', 'Anatomy glossary', 'FAQ', 'Credits'],
  onThisPage: 'On this page',
  featuresTitle: 'What you can do',
  features: [
    ['Explore the whole mouth in 3D', 'skull, maxilla, mandible, gums and all permanent teeth, including third molars (wisdom teeth).'],
    ['See inside every tooth', 'enamel, dentin, cementum, periodontal ligament, pulp chamber, pulp horns and root canals.'],
    ['Dissect anatomy', 'separate the layers step by step, or lay every structure out side by side.'],
    ['Section view', 'cut through the model to see cross-sections of teeth and bone.'],
    ['Three numbering systems', 'FDI (ISO 3950), Universal (ADA) and Palmer, switchable at any time.'],
    ['Nerves, vessels and muscles', 'inferior alveolar, lingual and superior alveolar nerves, the temporomandibular joint and the muscles of mastication.'],
    ['Search', 'any structure or tooth by name or number.'],
    ['English, Swedish and German', 'switch the language with the flags at the top of the explorer.'],
  ],
  teethTitle: 'All 32 permanent teeth',
  teethIntro: 'Each link opens the 3D explorer with that tooth selected.',
  quadrants: ['Upper right (FDI quadrant 1)', 'Upper left (FDI quadrant 2)', 'Lower left (FDI quadrant 3)', 'Lower right (FDI quadrant 4)'],
  numberingTitle: 'Tooth numbering systems',
  numberingIntro:
    'Dentists name teeth with a short code. Dental Scope shows all three systems in common use, so you can learn to read each one. Take the lower left first molar as an example:',
  numberingHead: ['System', 'How it works', 'Lower left first molar'],
  numberingRows: [
    ['FDI (ISO 3950)', 'Two digits: the quadrant (1 upper right, 2 upper left, 3 lower left, 4 lower right), then the position from the midline (1 central incisor to 8 third molar). Used in most of the world.', '36'],
    ['Universal (ADA)', 'Numbers 1 to 32, starting at the upper right third molar, running along the upper arch to the upper left, then back along the lower arch from the lower left third molar to the lower right. Used mainly in the United States.', '#19'],
    ['Palmer', 'A quadrant symbol with the position number 1 to 8, written here in text form as UR, UL, LL or LR plus the position. Common in the United Kingdom and in orthodontics.', 'LL6'],
  ],
  typesTitle: 'Tooth types',
  typesIntro:
    'The permanent dentition has eight teeth in each quadrant: two incisors, one canine, two premolars and three molars. Typical textbook values are shown; individual anatomy varies.',
  upper: 'upper',
  lower: 'lower',
  functionLabel: 'Function.',
  notesLabel: 'Notes.',
  rootsLabel: 'Roots',
  canalsLabel: 'Root canals',
  eruptionLabel: 'Eruption',
  viewIn3d: 'View in 3D:',
  glossaryTitle: 'Dental anatomy glossary',
  glossaryIntro: 'The structures you can select in the 3D model, in short.',
  glossaryGroups: ['Parts of a tooth', 'Tooth tissues', 'Periodontium (supporting tissues)', 'Jaws and joint', 'Nerves and vessels', 'Muscles of mastication and the face'],
  termNames: {
    cej: 'Cementoenamel junction (CEJ)',
    pdl: 'Periodontal ligament (PDL)',
    tmj: 'Temporomandibular joint (TMJ)',
    'maxillary-alveolar-process': 'Maxillary alveolar process',
    'mandibular-alveolar-process': 'Mandibular alveolar process',
  },
  faqTitle: 'Frequently asked questions',
  faq: [
    {
      q: 'What is Dental Scope?',
      a: 'Dental Scope is a free, open-source, interactive 3D model of human dental anatomy that runs in the web browser. You can rotate the skull and jaws, select any of the 32 permanent teeth, peel away enamel and dentin to see the pulp and root canals, and look at the nerves, vessels and muscles around the teeth.',
    },
    {
      q: 'Is Dental Scope free?',
      a: 'Yes. It is free to use with no account or installation, and its source code is open under the MIT licence. The 3D anatomy is derived from BodyParts3D and shared under CC BY-SA 2.1 Japan.',
    },
    {
      q: 'Who is it for?',
      a: 'Dental students, dental hygiene and dental assisting students, teachers who want a 3D model to show in class, and anyone curious about how teeth are built and numbered.',
    },
    {
      q: 'Which tooth numbering systems does it support?',
      a: 'All three common systems. The FDI World Dental Federation system (ISO 3950) uses two digits: quadrant then position, so the lower left first molar is 36. The Universal system used in the United States numbers the teeth 1 to 32, making the same tooth #19. Palmer notation writes the quadrant and position, here LL6. Switch between them with the FDI, UNI and PAL buttons.',
    },
    {
      q: 'Can I see inside a tooth?',
      a: 'Yes. Select a tooth and open Dissect anatomy to separate it into enamel, dentin, cementum, periodontal ligament, pulp chamber and root canals, or use the Section tool to cut through the model.',
    },
    {
      q: 'Does it work on phones and tablets?',
      a: 'Yes, in any current version of Chrome, Edge, Firefox or Safari with WebGL, on desktop, tablet or phone.',
    },
    {
      q: 'Which languages is it available in?',
      a: 'English, Swedish and German. The whole explorer, including the anatomical names and descriptions, is translated; choose a language with the flags at the top.',
    },
    {
      q: 'Can Dental Scope be used for diagnosis?',
      a: 'No. Dental Scope is an educational reference only. Internal tooth tissues are modeled with simplified proportions and nerves are placed schematically, so it must not be used for diagnosis, treatment planning or clinical decisions.',
    },
  ],
  creditsTitle: 'Credits and licence',
  creditsHtml:
    'Made by {author}. The source code is on <a href="{repo}" rel="noopener">GitHub</a>. The jaws, teeth, skull and muscles come from <a href="{bp3d}" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, licensed under <a href="{licence}" rel="noopener">CC Attribution-Share Alike 2.1 Japan</a>. Third molars, gums, alveolar bone and the joint are derived from those meshes; enamel, dentin, cementum, periodontal ligament, pulp and canals are modeled with simplified proportions; nerves and vessels are schematic.',
  note: 'Dental Scope is an educational reference. It is not intended for diagnosis, treatment planning or clinical decisions.',
  footer: 'Free 3D dental anatomy',
  madeBy: 'Made by',
  otherLanguages: 'Language',
};

const sv: AboutText = {
  htmlLang: 'sv',
  title: 'Om Dental Scope: gratis interaktiv 3D-atlas över tandanatomi',
  description:
    'En gratis 3D-tandatlas med öppen källkod för tandläkarstudenter: varje permanent tand, tandnumrering, tandvävnader, käkar, nerver och muskler, förklarade.',
  openExplorer: 'Öppna 3D-utforskaren →',
  h1: 'Dental Scope: gratis interaktiv tandanatomi i 3D',
  lede: 'Dental Scope är en gratis 3D-utforskare av tandanatomi med öppen källkod. Rotera en hel skalle och båda käkarna, välj vilken som helst av de 32 permanenta tänderna och dissekera en tand lager för lager, från emalj och dentin ner till pulpan och rotkanalerna. Den körs i webbläsaren utan att något behöver installeras.',
  toc: ['Funktioner', 'Alla 32 tänder', 'Tandnumrering', 'Tandtyper', 'Anatomisk ordlista', 'Vanliga frågor', 'Källor'],
  onThisPage: 'På den här sidan',
  featuresTitle: 'Vad du kan göra',
  features: [
    ['Utforska hela munnen i 3D', 'skalle, överkäke, underkäke, tandkött och alla permanenta tänder, inklusive tredje molarerna (visdomständerna).'],
    ['Se in i varje tand', 'emalj, dentin, rotcement, parodontalligament, pulpakammare, pulpahorn och rotkanaler.'],
    ['Dissekera anatomin', 'separera lagren steg för steg, eller lägg ut varje struktur sida vid sida.'],
    ['Snittvy', 'skär genom modellen och se tvärsnitt av tänder och ben.'],
    ['Tre numreringssystem', 'FDI (ISO 3950), Universal (ADA) och Palmer, som du kan växla mellan när som helst.'],
    ['Nerver, kärl och muskler', 'n. alveolaris inferior, n. lingualis och de övre alveolarnerverna, käkleden och tuggmusklerna.'],
    ['Sök', 'efter valfri struktur eller tand med namn eller nummer.'],
    ['Engelska, svenska och tyska', 'byt språk med flaggorna högst upp i utforskaren.'],
  ],
  teethTitle: 'Alla 32 permanenta tänder',
  teethIntro: 'Varje länk öppnar 3D-utforskaren med den tanden vald.',
  quadrants: ['Övre höger (FDI-kvadrant 1)', 'Övre vänster (FDI-kvadrant 2)', 'Nedre vänster (FDI-kvadrant 3)', 'Nedre höger (FDI-kvadrant 4)'],
  numberingTitle: 'Tandnumreringssystem',
  numberingIntro:
    'Tandläkare anger tänder med en kort kod. Dental Scope visar alla tre system som används i dag, så att du kan lära dig läsa vart och ett. Ta underkäkens vänstra första molar som exempel:',
  numberingHead: ['System', 'Så fungerar det', 'Vänster första molar i underkäken'],
  numberingRows: [
    ['FDI (ISO 3950)', 'Två siffror: kvadranten (1 övre höger, 2 övre vänster, 3 nedre vänster, 4 nedre höger) och sedan positionen från mittlinjen (1 central incisiv till 8 tredje molar). Används i större delen av världen, även i Sverige.', '36'],
    ['Universal (ADA)', 'Nummer 1 till 32, med start vid överkäkens högra tredje molar, längs överkäkens tandbåge till vänster sida och sedan tillbaka längs underkäkens tandbåge från vänster tredje molar till höger. Används främst i USA.', '#19'],
    ['Palmer', 'En kvadrantsymbol med positionsnumret 1 till 8, här skriven i textform som UR, UL, LL eller LR (engelska förkortningar för övre höger, övre vänster, nedre vänster, nedre höger) följt av positionen. Vanlig i Storbritannien och inom ortodonti.', 'LL6'],
  ],
  typesTitle: 'Tandtyper',
  typesIntro:
    'Den permanenta tandsättningen har åtta tänder i varje kvadrant: två incisiver, en hörntand, två premolarer och tre molarer. Typiska läroboksvärden visas; den individuella anatomin varierar.',
  upper: 'övre',
  lower: 'nedre',
  functionLabel: 'Funktion.',
  notesLabel: 'Kliniskt.',
  rootsLabel: 'Rötter',
  canalsLabel: 'Rotkanaler',
  eruptionLabel: 'Eruption',
  viewIn3d: 'Visa i 3D:',
  glossaryTitle: 'Ordlista för tandanatomi',
  glossaryIntro: 'Strukturerna du kan välja i 3D-modellen, kortfattat.',
  glossaryGroups: ['Tandens delar', 'Tandvävnader', 'Parodontium (tandens stödjevävnader)', 'Käkar och käkled', 'Nerver och kärl', 'Tuggmuskler och ansiktsmuskler'],
  termNames: {
    crown: 'Krona',
    root: 'Rot',
    cej: 'Emalj-cementgränsen (ECG)',
    apex: 'Rotspets (apex)',
    enamel: 'Emalj',
    dentin: 'Dentin',
    cementum: 'Rotcement',
    pulp: 'Pulpa',
    'pulp-chamber': 'Pulpakammare',
    'pulp-horn': 'Pulpahorn',
    'root-canals': 'Rotkanaler',
    'apical-foramen': 'Foramen apicale',
    periodontium: 'Parodontium',
    gingiva: 'Gingiva (tandkött)',
    pdl: 'Parodontalligament (PDL)',
    'maxillary-alveolar-process': 'Överkäkens alveolarutskott',
    'mandibular-alveolar-process': 'Underkäkens alveolarutskott',
    maxilla: 'Maxilla (överkäke)',
    mandible: 'Mandibel (underkäke)',
    'mandibular-condyle': 'Underkäkens ledhuvud',
    tmj: 'Käkleden (TMJ)',
    'articular-disc': 'Ledskiva (discus articularis)',
    'mandibular-foramen': 'Foramen mandibulae',
    'mental-foramen': 'Foramen mentale',
    'inferior-alveolar-nerve': 'Nervus alveolaris inferior',
    'mental-nerve': 'Nervus mentalis',
    'incisive-nerve': 'Nervus incisivus',
    'lingual-nerve': 'Nervus lingualis',
    'infraorbital-nerve': 'Nervus infraorbitalis',
    'posterior-superior-alveolar-nerve': 'Rami alveolares superiores posteriores',
    'middle-superior-alveolar-nerve': 'Ramus alveolaris superior medius',
    'anterior-superior-alveolar-nerve': 'Rami alveolares superiores anteriores',
    'inferior-alveolar-artery': 'Arteria alveolaris inferior',
    masseter: 'Musculus masseter',
    temporalis: 'Musculus temporalis',
    'medial-pterygoid': 'Musculus pterygoideus medialis',
    'lateral-pterygoid': 'Musculus pterygoideus lateralis',
    buccinator: 'Musculus buccinator',
    'orbicularis-oris': 'Musculus orbicularis oris',
    mentalis: 'Musculus mentalis',
  },
  faqTitle: 'Vanliga frågor',
  faq: [
    {
      q: 'Vad är Dental Scope?',
      a: 'Dental Scope är en gratis, interaktiv 3D-modell av människans tandanatomi med öppen källkod som körs i webbläsaren. Du kan rotera skallen och käkarna, välja vilken som helst av de 32 permanenta tänderna, skala bort emalj och dentin för att se pulpan och rotkanalerna, och titta på nerverna, kärlen och musklerna runt tänderna.',
    },
    {
      q: 'Är Dental Scope gratis?',
      a: 'Ja. Det är gratis att använda utan konto eller installation, och källkoden är öppen under MIT-licensen. 3D-anatomin är härledd från BodyParts3D och delas under CC BY-SA 2.1 Japan.',
    },
    {
      q: 'Vem är det till för?',
      a: 'Tandläkarstudenter, tandhygieniststudenter och blivande tandsköterskor, lärare som vill visa en 3D-modell i undervisningen och alla som är nyfikna på hur tänder är uppbyggda och numrerade.',
    },
    {
      q: 'Vilka tandnumreringssystem stöds?',
      a: 'Alla tre vanliga system. FDI-systemet (ISO 3950), som används i Sverige, har två siffror: kvadrant och sedan position, så underkäkens vänstra första molar är 36. Universal-systemet, som används i USA, numrerar tänderna 1 till 32, vilket gör samma tand till #19. Palmer-notationen anger kvadrant och position, här LL6. Växla mellan dem med knapparna FDI, UNI och PAL.',
    },
    {
      q: 'Kan jag se inuti en tand?',
      a: 'Ja. Välj en tand och öppna Dissekera anatomin för att dela upp den i emalj, dentin, rotcement, parodontalligament, pulpakammare och rotkanaler, eller använd Snitt-verktyget för att skära genom modellen.',
    },
    {
      q: 'Fungerar det på mobiler och surfplattor?',
      a: 'Ja, i alla aktuella versioner av Chrome, Edge, Firefox och Safari med WebGL, på dator, surfplatta och mobil.',
    },
    {
      q: 'Vilka språk finns det på?',
      a: 'Engelska, svenska och tyska. Hela utforskaren är översatt, även de anatomiska namnen och beskrivningarna; välj språk med flaggorna högst upp.',
    },
    {
      q: 'Kan Dental Scope användas för diagnostik?',
      a: 'Nej. Dental Scope är enbart ett referensmaterial för utbildning. Tändernas inre vävnader är modellerade med förenklade proportioner och nerverna är schematiskt placerade, så det får inte användas för diagnostik, behandlingsplanering eller kliniska beslut.',
    },
  ],
  creditsTitle: 'Källor och licens',
  creditsHtml:
    'Skapad av {author}. Källkoden finns på <a href="{repo}" rel="noopener">GitHub</a>. Käkarna, tänderna, skallen och musklerna kommer från <a href="{bp3d}" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, licensierat under <a href="{licence}" rel="noopener">CC Attribution-Share Alike 2.1 Japan</a>. Tredje molarerna, tandköttet, alveolarbenet och käkleden är härledda från dessa modeller; emalj, dentin, rotcement, parodontalligament, pulpa och kanaler är modellerade med förenklade proportioner; nerver och kärl är schematiska.',
  note: 'Dental Scope är ett referensmaterial för utbildning. Det är inte avsett för diagnostik, behandlingsplanering eller kliniska beslut.',
  footer: 'Gratis tandanatomi i 3D',
  madeBy: 'Skapad av',
  otherLanguages: 'Språk',
};

const de: AboutText = {
  htmlLang: 'de',
  title: 'Über Dental Scope: kostenloser interaktiver 3D-Atlas der Zahnanatomie',
  description:
    'Ein kostenloser Open-Source-3D-Zahnatlas für Zahnmedizinstudierende: jeder bleibende Zahn, Zahnschemata, Zahngewebe, Kiefer, Nerven und Muskeln erklärt.',
  openExplorer: '3D-Explorer öffnen →',
  h1: 'Dental Scope: kostenlose interaktive Zahnanatomie in 3D',
  lede: 'Dental Scope ist ein kostenloser Open-Source-3D-Explorer der Zahnanatomie. Drehe einen vollständigen Schädel mit beiden Kiefern, wähle einen der 32 bleibenden Zähne und zerlege einen Zahn Schicht für Schicht, vom Schmelz und Dentin bis zur Pulpa und zu den Wurzelkanälen. Er läuft im Browser, ohne dass etwas installiert werden muss.',
  toc: ['Funktionen', 'Alle 32 Zähne', 'Zahnschemata', 'Zahntypen', 'Anatomie-Glossar', 'Häufige Fragen', 'Quellen'],
  onThisPage: 'Auf dieser Seite',
  featuresTitle: 'Was du tun kannst',
  features: [
    ['Den ganzen Mund in 3D erkunden', 'Schädel, Oberkiefer, Unterkiefer, Zahnfleisch und alle bleibenden Zähne, einschließlich der Weisheitszähne (dritte Molaren).'],
    ['In jeden Zahn hineinsehen', 'Zahnschmelz, Dentin, Wurzelzement, Desmodont, Pulpakammer, Pulpahörner und Wurzelkanäle.'],
    ['Anatomie zerlegen', 'die Schichten Schritt für Schritt trennen oder jede Struktur nebeneinander auslegen.'],
    ['Schnittansicht', 'durch das Modell schneiden und Querschnitte von Zähnen und Knochen betrachten.'],
    ['Drei Zahnschemata', 'FDI (ISO 3950), Universal (ADA) und Palmer, jederzeit umschaltbar.'],
    ['Nerven, Gefäße und Muskeln', 'N. alveolaris inferior, N. lingualis und die oberen Alveolarnerven, das Kiefergelenk und die Kaumuskulatur.'],
    ['Suche', 'nach jeder Struktur und jedem Zahn über Name oder Nummer.'],
    ['Englisch, Schwedisch und Deutsch', 'die Sprache über die Flaggen oben im Explorer umschalten.'],
  ],
  teethTitle: 'Alle 32 bleibenden Zähne',
  teethIntro: 'Jeder Link öffnet den 3D-Explorer mit dem ausgewählten Zahn.',
  quadrants: ['Oben rechts (FDI-Quadrant 1)', 'Oben links (FDI-Quadrant 2)', 'Unten links (FDI-Quadrant 3)', 'Unten rechts (FDI-Quadrant 4)'],
  numberingTitle: 'Zahnschemata',
  numberingIntro:
    'In der Zahnmedizin werden Zähne mit einem kurzen Code bezeichnet. Dental Scope zeigt alle drei gebräuchlichen Systeme, damit du jedes lesen lernst. Als Beispiel dient der erste Molar im Unterkiefer links:',
  numberingHead: ['System', 'So funktioniert es', 'Erster Molar im Unterkiefer links'],
  numberingRows: [
    ['FDI (ISO 3950)', 'Zwei Ziffern: der Quadrant (1 oben rechts, 2 oben links, 3 unten links, 4 unten rechts), dann die Position ab der Mittellinie (1 mittlerer Schneidezahn bis 8 Weisheitszahn). Weltweit am weitesten verbreitet, auch in Deutschland, Österreich und der Schweiz.', '36'],
    ['Universal (ADA)', 'Die Zahlen 1 bis 32, beginnend beim oberen rechten Weisheitszahn, entlang des oberen Zahnbogens nach links und dann zurück entlang des unteren Zahnbogens vom unteren linken Weisheitszahn nach rechts. Vor allem in den USA gebräuchlich.', '#19'],
    ['Palmer', 'Ein Quadrantensymbol mit der Positionsnummer 1 bis 8, hier in Textform als UR, UL, LL oder LR (englische Abkürzungen für oben rechts, oben links, unten links, unten rechts) plus Position geschrieben. Verbreitet in Großbritannien und in der Kieferorthopädie.', 'LL6'],
  ],
  typesTitle: 'Zahntypen',
  typesIntro:
    'Das bleibende Gebiss hat acht Zähne pro Quadrant: zwei Schneidezähne, einen Eckzahn, zwei Prämolaren und drei Molaren. Gezeigt werden typische Lehrbuchwerte; die individuelle Anatomie variiert.',
  upper: 'oben',
  lower: 'unten',
  functionLabel: 'Funktion.',
  notesLabel: 'Klinisches.',
  rootsLabel: 'Wurzeln',
  canalsLabel: 'Wurzelkanäle',
  eruptionLabel: 'Durchbruch',
  viewIn3d: 'In 3D ansehen:',
  glossaryTitle: 'Glossar der Zahnanatomie',
  glossaryIntro: 'Die Strukturen, die du im 3D-Modell auswählen kannst, in Kürze.',
  glossaryGroups: ['Teile des Zahns', 'Zahngewebe', 'Parodontium (Zahnhalteapparat)', 'Kiefer und Kiefergelenk', 'Nerven und Gefäße', 'Kau- und Gesichtsmuskulatur'],
  termNames: {
    crown: 'Krone',
    root: 'Wurzel',
    cej: 'Schmelz-Zement-Grenze (SZG)',
    apex: 'Wurzelspitze (Apex)',
    enamel: 'Zahnschmelz',
    dentin: 'Dentin',
    cementum: 'Wurzelzement',
    pulp: 'Zahnpulpa',
    'pulp-chamber': 'Pulpakammer',
    'pulp-horn': 'Pulpahorn',
    'root-canals': 'Wurzelkanäle',
    'apical-foramen': 'Foramen apicale',
    periodontium: 'Parodontium (Zahnhalteapparat)',
    gingiva: 'Gingiva (Zahnfleisch)',
    pdl: 'Desmodont (Wurzelhaut)',
    'maxillary-alveolar-process': 'Alveolarfortsatz des Oberkiefers',
    'mandibular-alveolar-process': 'Alveolarfortsatz des Unterkiefers',
    maxilla: 'Oberkiefer (Maxilla)',
    mandible: 'Unterkiefer (Mandibula)',
    'mandibular-condyle': 'Unterkieferköpfchen',
    tmj: 'Kiefergelenk',
    'articular-disc': 'Discus articularis',
    'mandibular-foramen': 'Foramen mandibulae',
    'mental-foramen': 'Foramen mentale',
    'inferior-alveolar-nerve': 'Nervus alveolaris inferior',
    'mental-nerve': 'Nervus mentalis',
    'incisive-nerve': 'Nervus incisivus',
    'lingual-nerve': 'Nervus lingualis',
    'infraorbital-nerve': 'Nervus infraorbitalis',
    'posterior-superior-alveolar-nerve': 'Rami alveolares superiores posteriores',
    'middle-superior-alveolar-nerve': 'Ramus alveolaris superior medius',
    'anterior-superior-alveolar-nerve': 'Rami alveolares superiores anteriores',
    'inferior-alveolar-artery': 'Arteria alveolaris inferior',
    masseter: 'Musculus masseter',
    temporalis: 'Musculus temporalis',
    'medial-pterygoid': 'Musculus pterygoideus medialis',
    'lateral-pterygoid': 'Musculus pterygoideus lateralis',
    buccinator: 'Musculus buccinator',
    'orbicularis-oris': 'Musculus orbicularis oris',
    mentalis: 'Musculus mentalis',
  },
  faqTitle: 'Häufige Fragen',
  faq: [
    {
      q: 'Was ist Dental Scope?',
      a: 'Dental Scope ist ein kostenloses, interaktives Open-Source-3D-Modell der menschlichen Zahnanatomie, das im Webbrowser läuft. Du kannst Schädel und Kiefer drehen, jeden der 32 bleibenden Zähne auswählen, Schmelz und Dentin abtragen, um Pulpa und Wurzelkanäle zu sehen, und die Nerven, Gefäße und Muskeln rund um die Zähne betrachten.',
    },
    {
      q: 'Ist Dental Scope kostenlos?',
      a: 'Ja. Die Nutzung ist kostenlos, ohne Konto und ohne Installation, und der Quellcode ist unter der MIT-Lizenz offen. Die 3D-Anatomie ist aus BodyParts3D abgeleitet und steht unter CC BY-SA 2.1 Japan.',
    },
    {
      q: 'Für wen ist es gedacht?',
      a: 'Für Studierende der Zahnmedizin, angehende Dentalhygieniker und zahnmedizinische Fachangestellte, Lehrende, die im Unterricht ein 3D-Modell zeigen möchten, und alle, die neugierig sind, wie Zähne aufgebaut und nummeriert sind.',
    },
    {
      q: 'Welche Zahnschemata werden unterstützt?',
      a: 'Alle drei gebräuchlichen Systeme. Das FDI-Zahnschema (ISO 3950), das im deutschsprachigen Raum verwendet wird, hat zwei Ziffern: Quadrant und Position, der erste Molar im Unterkiefer links ist also 36. Das in den USA verwendete Universal-System nummeriert die Zähne von 1 bis 32, derselbe Zahn ist dort #19. Die Palmer-Notation gibt Quadrant und Position an, hier LL6. Umschalten kannst du mit den Schaltflächen FDI, UNI und PAL.',
    },
    {
      q: 'Kann ich in einen Zahn hineinsehen?',
      a: 'Ja. Wähle einen Zahn und öffne „Anatomie zerlegen“, um ihn in Zahnschmelz, Dentin, Wurzelzement, Desmodont, Pulpakammer und Wurzelkanäle zu trennen, oder schneide mit dem Werkzeug „Schnitt“ durch das Modell.',
    },
    {
      q: 'Funktioniert es auf Smartphones und Tablets?',
      a: 'Ja, in jeder aktuellen Version von Chrome, Edge, Firefox oder Safari mit WebGL, auf Computer, Tablet oder Smartphone.',
    },
    {
      q: 'In welchen Sprachen ist es verfügbar?',
      a: 'Englisch, Schwedisch und Deutsch. Der gesamte Explorer ist übersetzt, einschließlich der anatomischen Bezeichnungen und Beschreibungen; die Sprache wählst du über die Flaggen oben.',
    },
    {
      q: 'Kann Dental Scope zur Diagnose verwendet werden?',
      a: 'Nein. Dental Scope ist ausschließlich ein Nachschlagewerk für die Lehre. Die inneren Zahngewebe sind mit vereinfachten Proportionen modelliert und die Nerven schematisch platziert, daher darf es nicht für Diagnosen, Behandlungsplanung oder klinische Entscheidungen verwendet werden.',
    },
  ],
  creditsTitle: 'Quellen und Lizenz',
  creditsHtml:
    'Erstellt von {author}. Der Quellcode liegt auf <a href="{repo}" rel="noopener">GitHub</a>. Kiefer, Zähne, Schädel und Muskeln stammen aus <a href="{bp3d}" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, lizenziert unter <a href="{licence}" rel="noopener">CC Attribution-Share Alike 2.1 Japan</a>. Weisheitszähne, Zahnfleisch, Alveolarknochen und Kiefergelenk sind aus diesen Modellen abgeleitet; Zahnschmelz, Dentin, Wurzelzement, Desmodont, Pulpa und Kanäle sind mit vereinfachten Proportionen modelliert; Nerven und Gefäße sind schematisch.',
  note: 'Dental Scope ist ein Nachschlagewerk für die Lehre. Es ist nicht für Diagnosen, Behandlungsplanung oder klinische Entscheidungen bestimmt.',
  footer: 'Kostenlose Zahnanatomie in 3D',
  madeBy: 'Erstellt von',
  otherLanguages: 'Sprache',
};

export const ABOUT_TEXT: Record<Lang, AboutText> = { en, sv, de };
