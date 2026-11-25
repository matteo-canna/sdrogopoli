// Catalogo completo delle 30 pedine 3D realistiche HD+ di Sdrogopoli (10 Personaggi articolati + 20 Oggetti).
import type { Appearance, BaseStyleId, FinishId, Player } from '../engine';

export type CategoryId = 'personaggi' | 'veicoli' | 'icone' | 'lusso' | 'cultura';

export interface CharacterDef {
  id: string;
  label: string;
  emoji: string;
  category: CategoryId;
  tagline: string;
  defaultAccent: string;
  defaultFinish?: FinishId;
}

export const CATEGORIES: Record<CategoryId, string> = {
  personaggi: '🎭 Personaggi (10)',
  veicoli: '🏎️ Veicoli (5)',
  icone: '🌍 Icone & Oggetti (5)',
  lusso: '👑 Lusso & Sculture (5)',
  cultura: '🎸 Musica & Retro (5)',
};

export const CHARACTERS: CharacterDef[] = [
  { id: "char_driver", label: "Pilota F1", emoji: "🏁", category: "personaggi", tagline: "Corpo atletico V-taper con tuta FIA trapuntata, cerniera zip e inserti ginocchia/gomiti, collare HANS sulle clavicole, mani a 5 dita con protezioni carbonio, scarpe racing con velcro, casco con visiera iridescente, volante HUD e coppa GP", defaultAccent: "#f4b400" },
  { id: "char_knight", label: "Cavaliere Paladino", emoji: "⚔️", category: "personaggi", tagline: "Corazza gotica anatomica a vita stretta con carena e nervature dorate, cotta di maglia a rilievo, faulds a 3 lamelle, scarselle, spallacci, cubitiere e ginocchiere alate, sabaton con speroni, guanti d'arme a 5 dita, mantello drappeggiato, scudo HD e spada lunga", defaultAccent: "#f4b400" },
  { id: "char_samurai", label: "Samurai Shogun", emoji: "⛩️", category: "personaggi", tagline: "Corazza Ō-yoroi sagomata a 5 bande con cordini Odoshi, piastre frontali e nodo Agemaki sul dorso, 6 gonnelle Kusazuri, pantaloni Hakama a pieghe profonde, schinieri Suneate a stecche, spallacci Sode, elmo Kabuto con Kuwagata, katana curva e ventaglio", defaultAccent: "#f4b400" },
  { id: "char_diver", label: "Palombaro Mark V", emoji: "🤿", category: "personaggi", tagline: "Scafandro in tela vulcanizzata con pieghe scolpite, imbracatura incrociata in cuoio con D-ring, cintura con 8 blocchi di piombo, corsaletto anatomico a 12 bulloni, scarponi con punta in ottone e suola in piombo, doppia bombola, elmo a 4 oblò, lanterna e tridente", defaultAccent: "#f4b400" },
  { id: "char_astronaut", label: "Astronauta EVA", emoji: "👨‍🚀", category: "personaggi", tagline: "Tuta pressurizzata scolpita con cuscinetti spalla metallici inclinati, soffietti articolari su gomiti e ginocchia, tubi ombelicali rosso/blu dallo zaino PLSS al modulo DCM HD, checklist da polso, stivali lunari a 5 nervature, casco a visiera dorata e bandiera", defaultAccent: "#ff9f1a" },
  { id: "char_steampunk", label: "Aviatore Steampunk", emoji: "⚙️", category: "personaggi", tagline: "Soprabito con falde drappeggiate e bandoliera, gilet doppiopetto, manometro alla cintura, braccio destro protesico clockwork con pistoni e ingranaggio al polso, pantaloni da cavallerizza con stivali alti stringati, volto scolpito con occhialoni multi-lente e jetpack", defaultAccent: "#00d2d3" },
  { id: "char_tycoon", label: "Magnate Gentiluomo", emoji: "🎩", category: "personaggi", tagline: "Frac sartoriale a vita stretta con code di rondine, revers in raso, rosa rossa boutonnière e fazzoletto da taschino, gilet doppiopetto con catenella d'oro, pantaloni con piega stirata, ghette bianche con bottoni su Oxford, volto cesellato con monocolo, cilindro e valigetta", defaultAccent: "#f4b400" },
  { id: "char_venetian", label: "Nobile Veneziano", emoji: "🎭", category: "personaggi", tagline: "Giustacuore barocco in velluto con falda a 12 pieghe profonde, alamari dorati, jabot a 3 balze, balteo diagonale, paramani risvoltati, culottes con giarrettiere, polpacci scolpiti in calze di seta, scarpe barocche con fibbia e tacco rosso, mantello drappeggiato e maschera solare", defaultAccent: "#f4b400" },
  { id: "char_android", label: "Androide Cyber", emoji: "🤖", category: "personaggi", tagline: "Anatomia biomeccanica scolpita: colonna vertebrale a 7 vertebre esposte, 6 piastre addominali con 4 pistoni idraulici, pettorali corazzati con reattore esagonale pulsante, servo-anelli LED su gomiti e ginocchia, mani bioniche a 5 dita, stivali split-toe, alette ioniche e Tesseract", defaultAccent: "#00d2d3" },
  { id: "char_wizard", label: "Arcimago Alchimista", emoji: "🧙‍♂️", category: "personaggi", tagline: "Tunica scultorea a 14 pieghe verticali profonde con orlo e bordi dorati, ampie maniche a campana drappeggiate, mantellina a pieghe con fermaglio, bandoliera con 3 ampolle luminose e astuccio pergamene, volto scolpito con barba a 3 strati, grimorio HD e astrolabio rotante", defaultAccent: "#f4b400" },
  { id: "f1", label: "Monoposto F1", emoji: "🏎️", category: "veicoli", tagline: "Cerchi 10 razze con dischi & pinze freno, doppi triangoli + pushrod, Halo, volante LED, feritoie cofano, shark fin, beam wing, pod DRS e scarichi wastegate", defaultAccent: "#f4b400" },
  { id: "vespa", label: "Scooter Vintage", emoji: "🛵", category: "veicoli", tagline: "Forcella con molla a 6 spire, bordoscudo cromato, tachimetro HD, bauletto con serratura, leve freno, portapacchi con ruota di scorta e targa SD 64", defaultAccent: "#ffffff" },
  { id: "vintage_car", label: "Auto d'Epoca", emoji: "🚗", category: "veicoli", tagline: "Cinghie cofano in pelle e fibbie, radiatore a 9 lamelle con mascotte alata, cruscotto in radica a 3 strumenti, parabrezza a V con tergi, collettori cromati e targa SD 32", defaultAccent: "#f4b400" },
  { id: "yacht", label: "Yacht di Lusso", emoji: "⛵", category: "veicoli", tagline: "Bottazzo inox, prendisole e osteriggio, doppie eliche & timoni in ottone, scaletta bagno, pozzetto con tavolino, luci di via, flybridge, satcom, VHF e radar rotante", defaultAccent: "#00d2d3" },
  { id: "biplane", label: "Biplano", emoji: "✈️", category: "veicoli", tagline: "Motore radiale a 9 cilindri alettati con collettore scarico, elica imbullonata rotante, ali centinate con coccarde tricolore, luci alari, tiranti a X e carrello a V", defaultAccent: "#f4b400" },
  { id: "camera", label: "Fotocamera Reflex", emoji: "📷", category: "icone", tagline: "Corpo smussato in similpelle, targhetta SDROGO, ghiere incise, leva carica, LCD Live-View HUD, D-pad, 50mm f/1.4 con 32 zigrinature 3D, iride 8 lamelle e paraluce a petalo", defaultAccent: "#ff4757" },
  { id: "moka", label: "Moka Italiana", emoji: "☕", category: "icone", tagline: "Caldaia ottagonale con 8 costolature lucide, valvola esagonale in ottone, guarnizione visibile, beccuccio scavato, cerniera a 3 nodi, alzacoperchio e manico imbullonato", defaultAccent: "#f4b400" },
  { id: "lighthouse", label: "Faro Costiero", emoji: "🗼", category: "icone", tagline: "Scogliera stratificata con casetta del guardiano illuminata, torre a 5 fasce con finestre a crociera, galleria a 16 mensole, vetrata elicoidale, lente Fresnel a doppio fascio e banderuola", defaultAccent: "#ffffff" },
  { id: "globe", label: "Mappamondo Antico", emoji: "🌍", category: "icone", tagline: "Globo cartografico anticato 1024×512 inclinato a 23,5° rotante, meridiano graduato in ottone a 19 tacche, anello orizzonte con rosa dei venti e piedistallo in noce", defaultAccent: "#f4b400" },
  { id: "rocket", label: "Razzo Spaziale", emoji: "🚀", category: "icone", tagline: "Fusoliera tornita con 54 micro-rivetti, 4 ugelli RCS, oblò in ottone a 12 bulloni, portello posteriore, alette con pistoni e piastre, ugello rigenerativo con turbopompe e plasma", defaultAccent: "#ff9f1a" },
  { id: "chess_knight", label: "Cavallo Scacchi", emoji: "♞", category: "lusso", tagline: "Piedistallo Staunton a 7 modanature, anatomia scolpita con guance, orecchie gemelle, briglie e bardatura pettorale in ottone con borchie e criniera a 11 ciocche ondulate", defaultAccent: "#f4b400" },
  { id: "pocket_watch", label: "Orologio Taschino", emoji: "🕰️", category: "lusso", tagline: "Coperchio Hunter aperto su cerniera, quadrante guilloché Tourbillon con 3 ingranaggi 3D animati e rubini, lancette Breguet, corona zigrinata e catenella a 18 maglie su leggio", defaultAccent: "#f4b400" },
  { id: "crown", label: "Corona Reale", emoji: "👑", category: "lusso", tagline: "Bordo d'ermellino con 12 codine, 48 perle sui bordi e 48 sugli 8 archi a S, gigli e croci patenti alternate, 8 gemme su castoni, cuscino in velluto e globo crucigero con rubino", defaultAccent: "#f4b400" },
  { id: "diamond", label: "Diamante Brillante", emoji: "💎", category: "lusso", tagline: "Taglio brillante Tolkowsky a 16 facce con doppio nucleo fuoco prismatico, 6 griffe con punte a tenaglia, filigrana a galleria e collare Halo Pavé con 16 micro-diamanti", defaultAccent: "#f4b400" },
  { id: "skyscraper", label: "Grattacielo Déco", emoji: "🏛️", category: "lusso", tagline: "Portico monumentale luminoso con pensiline in ottone, 4 gradoni con spandrel dorati, lesene cromate, gargoyle Art Déco, corona a 4 archi con 32 finestre triangolari e guglia LED", defaultAccent: "#f4b400" },
  { id: "guitar", label: "Chitarra Elettrica", emoji: "🎸", category: "cultura", tagline: "Su stand A-frame imbottito, battipenna a 8 viti, 3 pickup a 6 poli, selettore 5-way, ponte a 6 sellette con leva vibrato, 18 tasti con segnatasti madreperla, 6 corde calibrate e meccaniche", defaultAccent: "#ffffff" },
  { id: "gramophone", label: "Grammofono", emoji: "📻", category: "cultura", tagline: "Cassa in noce su 4 piedini in ottone con pannelli intarsiati, manovella tornita, vinile 78 giri HD rotante, leva velocità, testina con mica e tromba Morning-Glory a 10 petali", defaultAccent: "#f4b400" },
  { id: "arcade", label: "Cabinato Arcade", emoji: "🕹️", category: "cultura", tagline: "Grafica laterale synthwave, T-molding continuo, marquee SDROGO 1984, feritoie speaker, CRT pixel-art con HUD punteggio, 2 joystick + 6 tasti + P1/P2 start e gettoniera 25¢", defaultAccent: "#00d2d3" },
  { id: "anchor", label: "Ancora Marinara", emoji: "⚓", category: "cultura", tagline: "Letto di cima a 3 spire, fuso ottagonale forgiato, ceppo in quercia con 4 fascette in ferro e sfere in ottone, marre con nervature, grillo con perno e catena navale a 24 maglie stud-link", defaultAccent: "#f4b400" },
  { id: "telescope", label: "Telescopio", emoji: "🔭", category: "cultura", tagline: "Treppiede a doppi montanti con vassoio e 3 oculari di ricambio, montatura equatoriale con cerchi graduati, doppio contrappeso, cavo micrometrico, focheggiatore e cercatore collimato", defaultAccent: "#f4b400" },
];

export const FINISH_OPTIONS: Record<FinishId, string> = {
  real: '🎨 Materiali reali (PBR)',
  pewter: '🪙 Peltro da collezione',
  gold: '🏆 Oro 24k lucido',
  bronze: '🗿 Bronzo anticato',
  chrome: '🪞 Cromo a specchio',
  porcelain: '🏺 Porcellana smaltata',
};

export const BASE_OPTIONS: Record<BaseStyleId, string> = {
  minimal: '⚪ Anello cromato',
  marble: '🏛️ Marmo venato',
  walnut: '🪵 Noce intagliato',
  coin: '🪙 Moneta zigrinata',
  carbon: '🏁 Carbonio & Neon',
  none: '✨ Senza basetta',
};

export const COLOR_CHOICES = [
  '#d93829', '#2366c8', '#eab308', '#7c3aed',
  '#1f8a4c', '#db2777', '#0891b2', '#6b4226',
  '#f97316', '#84cc16', '#64748b', '#1e293b',
];

export const COLOR_NAMES: Record<string, string> = {
  '#d93829': 'Rosso Corsa',
  '#2366c8': 'Blu Zaffiro',
  '#eab308': 'Giallo Modena',
  '#7c3aed': 'Viola Reale',
  '#1f8a4c': 'Verde Inglese',
  '#db2777': 'Magenta',
  '#0891b2': 'Ottanio',
  '#6b4226': 'Bronzo Scuro',
  '#f97316': 'Arancio',
  '#84cc16': 'Lime',
  '#64748b': 'Grigio Titanio',
  '#1e293b': 'Nero Ossidiana',
};

export const ACCENT_CHOICES = [
  '#f4b400', '#ffffff', '#1e272e', '#ff4757', '#00d2d3',
  '#ff9f1a', '#a55eea', '#2ed573', '#cbd5e1', '#b45309',
];

export const ACCENT_NAMES: Record<string, string> = {
  '#f4b400': 'Oro',
  '#ffffff': 'Bianco Perla',
  '#1e272e': 'Carbonio',
  '#ff4757': 'Rosso Racing',
  '#00d2d3': 'Ciano',
  '#ff9f1a': 'Ambra',
  '#a55eea': 'Ametista',
  '#2ed573': 'Smeraldo',
  '#cbd5e1': 'Argento',
  '#b45309': 'Rame',
};

const LEGACY_MAP: Record<string, string> = {
  knight: 'char_knight',
  mage: 'char_wizard',
  barbarian: 'char_samurai',
  rogue: 'char_steampunk',
  hooded: 'char_venetian',
};

export function characterDef(id: string): CharacterDef {
  const mapped = LEGACY_MAP[id] ?? id;
  return CHARACTERS.find((c) => c.id === mapped) ?? CHARACTERS[0];
}

// 12 posti predefiniti che alternano personaggi articolati e oggetti iconici.
const SEAT_CHARACTERS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 21, 18];

export function defaultAppearance(seat: number): Appearance {
  const def = CHARACTERS[SEAT_CHARACTERS[seat % SEAT_CHARACTERS.length]];
  return {
    character: def.id,
    color: COLOR_CHOICES[seat % COLOR_CHOICES.length],
    accentColor: def.defaultAccent,
    finish: def.defaultFinish ?? 'real',
    baseStyle: 'minimal',
    hat: false,
    cape: false,
    item: '',
  };
}

export function normalizeAppearance(look: Partial<Appearance>, seat = 0): Appearance {
  const base = defaultAppearance(seat);
  const def = characterDef(look.character ?? base.character);
  const finish: FinishId = look.finish && look.finish in FINISH_OPTIONS ? look.finish : 'real';
  const baseStyle: BaseStyleId = look.baseStyle && look.baseStyle in BASE_OPTIONS ? look.baseStyle : 'minimal';
  return {
    character: def.id,
    color: look.color ?? base.color,
    accentColor: look.accentColor ?? def.defaultAccent,
    finish,
    baseStyle,
    hat: look.hat ?? false,
    cape: look.cape ?? false,
    item: look.item ?? '',
  };
}

export function appearanceOf(p: Pick<Player, 'id' | 'appearance'>): Appearance {
  return p.appearance ? normalizeAppearance(p.appearance, p.id) : defaultAppearance(p.id);
}

export function playerColor(p: Pick<Player, 'id' | 'appearance'>): string {
  return appearanceOf(p).color;
}
