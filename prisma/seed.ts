// Seed data. Grounded in the real Cinco Sentidos discovery doc research.
//
//   npm run db:seed            Reference data only: the operation catalog and the Knowledge Layer
//                              (regions, grapes, oak, toast, aging). Safe for production. Run
//                              `npm run db:admins` first: the knowledge entries are authored by an
//                              administrator.
//   SEED_DEMO=1 npm run db:seed   Also creates demo staff logins (shared password) and the demo
//                              project "El Malbec Demo" (barrel CS-024). NEVER run this in production.
/* eslint-disable no-console */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { DEFAULT_OPERATION_CATALOG } from "../src/lib/operation-catalog";

const DEMO = process.env.SEED_DEMO === "1";
const DEMO_PASSWORD = "cincosentidos";

function daysFromNow(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function date(iso: string) {
  // Parsed as a local calendar date, not UTC — see src/lib/dates.ts.
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

async function createDemoStaff() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: "admin.demo@example.com" },
    update: {},
    create: {
      email: "admin.demo@example.com",
      name: "Admin Demo",
      role: "owner_admin",
      passwordHash,
    },
  });

  const enologo = await prisma.user.upsert({
    where: { email: "enologo.demo@example.com" },
    update: {},
    create: {
      email: "enologo.demo@example.com",
      name: "Enólogo Demo",
      role: "enologo",
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "comercial.demo@example.com" },
    update: {},
    create: {
      email: "comercial.demo@example.com",
      name: "Comercial Demo",
      role: "comercial",
      passwordHash,
    },
  });
  return { owner, enologo };
}

async function main() {
  console.log("Seeding…");

  // ---------------------------------------------------------------------
  // Operation type library — reusable across every project (§08, §18)
  // ---------------------------------------------------------------------
  const opTypes: Record<string, { id: string }> = {};
  // Research-based starting catalog (see src/lib/operation-catalog.ts). Rows
  // that already exist and were never given catalog metadata get it once;
  // anything the admin has since edited is left alone.
  for (const [i, def] of DEFAULT_OPERATION_CATALOG.entries()) {
    const existing = await prisma.operationType.findUnique({ where: { name: def.name } });
    if (existing && existing.description !== null) {
      opTypes[def.name] = existing;
      continue;
    }
    opTypes[def.name] = await prisma.operationType.upsert({
      where: { name: def.name },
      update: { description: def.description, category: def.category, sortOrder: i, systemKey: def.systemKey ?? null },
      create: { ...def, systemKey: def.systemKey ?? null, sortOrder: i },
    });
  }

  // ---------------------------------------------------------------------
  // Staff users
  // ---------------------------------------------------------------------
  const admin = DEMO
    ? null
    : await prisma.user.findFirst({ where: { role: "owner_admin" }, orderBy: { createdAt: "asc" } });
  if (!DEMO && !admin) throw new Error("No administrator found. Run `npm run db:admins` before seeding.");
  const demoStaff = DEMO ? await createDemoStaff() : null;
  const owner = demoStaff?.owner ?? admin!;
  const enologo = demoStaff?.enologo ?? admin!;

  // ---------------------------------------------------------------------
  // Knowledge Layer (§21) — the real Cinco Sentidos knowledge base: five
  // Mendoza growing locations, four grape varieties, two oak origins and a
  // comparison, four toast levels and three aging bands. Researched from
  // reputable sources (Wines of Argentina, Catena Institute-adjacent
  // terroir writing, GuildSomm-style grape profiles, cooperage technical
  // literature, INV official statistics for Ancellotta) — original prose,
  // hedged language throughout, sources kept for later staff review.
  // ---------------------------------------------------------------------
  const topicDefs = [
    { key: "region", label: "Regiones", sortOrder: 0 },
    { key: "variety", label: "Variedades de uva", sortOrder: 1 },
    { key: "oak_origin", label: "Origen del roble", sortOrder: 2 },
    { key: "toast_level", label: "Nivel de tueste", sortOrder: 3 },
    { key: "comparison", label: "Comparaciones", sortOrder: 4 },
    { key: "aging_band", label: "Tiempo de crianza", sortOrder: 5 },
    { key: "vintage", label: "Añada", sortOrder: 6 },
  ];
  const topics: Record<string, { id: string }> = {};
  for (const t of topicDefs) {
    topics[t.key] = await prisma.knowledgeTopic.upsert({
      where: { key: t.key },
      update: { label: t.label, sortOrder: t.sortOrder },
      create: t,
    });
  }

  // Each entry gets the next sortOrder within its own category, in the order
  // it's upserted below — so category pages read top-to-bottom the same way
  // this file does.
  const entrySortCounters: Record<string, number> = {};
  async function upsertEntry(input: {
    topicKey: string;
    key: string;
    title: string;
    locationLine?: string;
    elevationMeters?: number;
    teaser: string;
    factChips: { label: string; value: string }[];
    narrative: string;
    sources: { label: string; url: string }[];
  }) {
    const sortOrder = entrySortCounters[input.topicKey] ?? 0;
    entrySortCounters[input.topicKey] = sortOrder + 1;
    const data = {
      topicId: topics[input.topicKey].id,
      title: input.title,
      locationLine: input.locationLine,
      elevationMeters: input.elevationMeters,
      teaser: input.teaser,
      factChips: JSON.stringify(input.factChips),
      narrative: input.narrative,
      sources: JSON.stringify(input.sources),
      status: "published",
      sortOrder,
      authoredById: enologo.id,
    };
    return prisma.knowledgeEntry.upsert({
      where: { key: input.key },
      update: data,
      create: { key: input.key, ...data },
    });
  }

  // --- Locations ---------------------------------------------------------

  const agrelo = await upsertEntry({
    topicKey: "region",
    key: "agrelo-lujan-de-cuyo",
    title: "Agrelo",
    locationLine: "Luján de Cuyo, Mendoza, Argentina",
    elevationMeters: 1050,
    teaser:
      "Tu vino nació en Agrelo, donde el suelo pedregoso y las noches frías después del atardecer concentran la fruta y conservan su acidez.",
    factChips: [
      { label: "Elevación", value: "~900–1.100 m" },
      { label: "Suelo", value: "Aluvional, capas de grava sobre franco arenoso" },
      { label: "Clima", value: "Desértico, gran amplitud térmica" },
      { label: "Reconocida por", value: "Malbec estructurado y aromático" },
    ],
    narrative:
      "Agrelo es el distrito más austral y elevado de Luján de Cuyo, lo bastante cerca de la Cordillera como para sentirla en cada atardecer: el mismo subsuelo de grava pobre en materia orgánica que limita el vigor de la planta concentra la fruta, y el viento frío que baja de la montaña después del sol hace caer la temperatura de golpe, dejando que la uva conserve acidez mientras termina de madurar. Es una de las zonas más buscadas de Mendoza para tintos complejos — ahí está, por ejemplo, la bodega Catena Zapata — y su subzona más alta, Alto Agrelo, suele dar Malbec de fruta más oscura y taninos más finos. Nada de esto es una fórmula exacta: la altura y el suelo son un punto de partida, no una garantía, pero son una buena parte de por qué tu barrica empezó acá.",
    sources: [
      { label: "Wine-Searcher — Agrelo region overview", url: "https://www.wine-searcher.com/regions-agrelo" },
      { label: "La Madrid Wines — Agrelo terroir", url: "https://www.lamadridwines.com/en/agrelo-en/" },
      { label: "Belasco de Baquedano — Alto Agrelo terroir", url: "https://belascomalbec.com/terrior/" },
    ],
  });

  await upsertEntry({
    topicKey: "region",
    key: "lujan-de-cuyo",
    title: "Luján de Cuyo",
    locationLine: "Mendoza, Argentina",
    elevationMeters: 950,
    teaser:
      "Tu vino creció en Luján de Cuyo, la primera región de Argentina en obtener su propia Denominación de Origen Controlada, en 1989.",
    factChips: [
      { label: "Elevación", value: "~800–1.100 m según el distrito" },
      { label: "Distancia a la ciudad de Mendoza", value: "~25–30 km al sur" },
      { label: "Distritos", value: "Agrelo, Las Compuertas, Perdriel, Ugarteche, Vistalba" },
      { label: "Reconocida por", value: "Los Malbec más históricos de Mendoza" },
    ],
    narrative:
      "Luján de Cuyo queda justo al sur de la ciudad de Mendoza, pegado al pie de los Andes, y fue la primera zona del país en recibir una Denominación de Origen Controlada — un reconocimiento que en 1989 puso a su Malbec en un lugar aparte. No es un lugar uniforme: reúne distritos bien distintos, desde Las Compuertas, con viñedos viejos regados por canales centenarios, hasta Agrelo, más alto y pedregoso. Lo que comparten es el mismo patrón de fondo — suelos aluvionales pobres en nutrientes, sol intenso de día y un enfriamiento marcado apenas se esconde el sol — que en conjunto suele dar vinos con buena estructura y personalidad propia, más que una receta única.",
    sources: [
      { label: "Wine with Seth — Luján de Cuyo DOC", url: "https://www.winewithseth.com/winewiki/lujan-de-cuyo-doc-mendoza-argentina/" },
      { label: "Wine with Seth — Luján de Cuyo overview", url: "https://www.winewithseth.com/winewiki/lujan-de-cuyo/" },
    ],
  });

  const gualtallary = await upsertEntry({
    topicKey: "region",
    key: "gualtallary",
    title: "Gualtallary",
    locationLine: "Tupungato, Valle de Uco, Mendoza",
    elevationMeters: 1350,
    teaser:
      "Tu vino viene de Gualtallary, una de las zonas más altas de Mendoza, con un suelo calcáreo que es una rareza dentro de la región.",
    factChips: [
      { label: "Elevación", value: "~1.100–1.600 m (parcelas experimentales, más aún)" },
      { label: "Suelo", value: "Calcáreo, con caliche y arena sobre grava" },
      { label: "Amplitud térmica", value: "Hasta 20 °C entre el día y la noche" },
      { label: "Reconocida por", value: "Malbec mineral y Cabernet Franc de altura" },
    ],
    narrative:
      "Gualtallary está en Tupungato, al norte del Valle de Uco, y es una de las zonas de mayor altura que se cultivan en Mendoza — algunas parcelas superan los 1.900 metros. Lo que la hace realmente distinta es el suelo: una capa de caliche y carbonato de calcio poco común en el resto de la provincia, que junto a noches muy frías da vinos con más tensión y mineralidad que los de zonas más bajas, y menos sobre la fruta madura y generosa que domina en el llano. Ahí está el Viñedo Adrianna de Catena Zapata, una de las parcelas más citadas de Sudamérica, y en los últimos años la zona también viene ganando nombre por su Cabernet Franc de altura, más herbal y tenso que el de otras regiones.",
    sources: [
      { label: "Wine with Seth — Gualtallary", url: "https://www.winewithseth.com/winewiki/gualtallary/" },
      { label: "Vinos Argentinos — Gualtallary, extreme altitude", url: "https://www.vinosargentinos.com/wine-regions-of-argentina/gualtallary-extreme-altitude" },
      { label: "Wikipedia — Adrianna Vineyard", url: "https://en.wikipedia.org/wiki/Adrianna_Vineyard" },
    ],
  });

  await upsertEntry({
    topicKey: "region",
    key: "palmira-san-martin",
    title: "Palmira",
    locationLine: "San Martín, Este de Mendoza, Argentina",
    elevationMeters: 650,
    teaser:
      "Tu vino nació en Palmira, en el Este de Mendoza — una zona más baja y calurosa, regada por el río Tunuyán, con algunas de las viñas más viejas de la provincia.",
    factChips: [
      { label: "Elevación", value: "~600–700 m" },
      { label: "Clima", value: "Más cálido, menor amplitud térmica que el oeste" },
      { label: "Riego", value: "Río Tunuyán" },
      { label: "Reconocida por", value: "Viñas viejas y volumen — el Este es la zona más plantada de Mendoza" },
    ],
    narrative:
      "Palmira es un pueblo del departamento de San Martín, en el Este de Mendoza — una región bien distinta de Luján de Cuyo o el Valle de Uco: más baja, más plana y más calurosa, sin la cercanía directa a la Cordillera. Hay menos escrito específicamente sobre Palmira que sobre otras zonas de este listado, así que estos datos reflejan sobre todo al Este de Mendoza en general, regado por el río Tunuyán. Es, por superficie, la zona más plantada de la provincia, e históricamente asociada a volumen más que a exclusividad — pero también guarda algunas de las viñas más viejas de Mendoza, capaces de dar uvas con un carácter que la juventud no imita.",
    sources: [
      { label: "South America Wine Guide — Eastern Mendoza", url: "https://southamericawineguide.com/guide-to-eastern-mendoza-its-wine-regions/" },
      { label: "Wikipedia — Palmira, Mendoza", url: "https://en.wikipedia.org/wiki/Palmira" },
    ],
  });

  await upsertEntry({
    topicKey: "region",
    key: "vista-flores",
    title: "Vista Flores",
    locationLine: "Tunuyán, Valle de Uco, Mendoza",
    elevationMeters: 1000,
    teaser:
      "Tu vino se crió con uvas de Vista Flores, en el Valle de Uco — un lugar que atrajo a algunas de las familias vitivinícolas más prestigiosas de Burdeos.",
    factChips: [
      { label: "Elevación", value: "~900–1.100 m" },
      { label: "Amplitud térmica", value: "Más de 20 °C" },
      { label: "Suelo", value: "Aluvional, arena y limo sobre terrazas de río" },
      { label: "Reconocida por", value: "Malbec elegante y aromático" },
    ],
    narrative:
      "Vista Flores está en Tunuyán, en el corazón del Valle de Uco, con suelos de origen aluvional formados por el mismo río que le da nombre al departamento. Es un lugar con un peso simbólico particular: a fines de los años 90, siete familias bodegueras de Burdeos compraron ahí una gran extensión de tierra —hoy conocida como Clos de los Siete, guiada por el enólogo Michel Rolland— atraídas por la misma combinación de altura, sol seco y noches frías que define a gran parte del Valle de Uco. Esa amplitud térmica tan marcada suele dar Malbec de perfil más elegante y aromático que el de zonas más bajas, con un carácter que en su momento sorprendió a quienes venían de otra tradición vitivinícola completamente distinta.",
    sources: [
      { label: "Wine-Searcher — Vista Flores region overview", url: "https://www.wine-searcher.com/regions-vista+flores" },
      { label: "Wine with Seth — Clos de los Siete", url: "https://www.winewithseth.com/winewiki/clos-de-los-siete/" },
    ],
  });

  // --- Grapes --------------------------------------------------------------

  const malbec = await upsertEntry({
    topicKey: "variety",
    key: "malbec",
    title: "Malbec",
    locationLine: "La cepa insignia de Mendoza",
    teaser:
      "Tu vino es Malbec, la cepa insignia de Mendoza: fruta madura, taninos redondos y un color profundo que sirven de base para todo lo demás.",
    factChips: [
      { label: "Origen", value: "Cahors, suroeste de Francia" },
      { label: "En Mendoza desde", value: "Mediados/fines del siglo XIX" },
      { label: "Color", value: "Rojo profundo, casi tinta" },
      { label: "Cuerpo", value: "Pleno, taninos suaves y redondos" },
      { label: "Temperatura de servicio", value: "16–18 °C" },
      { label: "Marida bien con", value: "Asado y carnes rojas a la parrilla" },
    ],
    narrative:
      "El Malbec llegó a Mendoza desde el suroeste de Francia en algún momento entre 1853 y 1868 (las fuentes no coinciden en la fecha exacta), traído para fundar una escuela agrícola — y durante casi un siglo largo fue apenas una uva de mezcla, valorada por su color más que por su carácter. Su salto a cepa insignia es reciente, de las últimas tres décadas, de la mano de la altura y el sol seco de Mendoza, donde hoy Argentina produce cerca de dos tercios del Malbec del mundo. Da vinos de color intenso, taninos redondos y una fruta madura y generosa — ciruela, mora, un toque floral — que sirve de base antes de que el origen específico y la crianza terminen de darle forma: el mismo Malbec puede salir más fresco y floral en el Valle de Uco, o más denso y especiado en Luján de Cuyo.",
    sources: [
      { label: "Wikipedia — Malbec", url: "https://en.wikipedia.org/wiki/Malbec" },
      { label: "Shades of Grape — Malbec, the immigrant grape", url: "https://www.shadesofgrape.ca/p/malbec-the-immigrant-grape-that-conquered" },
      { label: "Wines of Argentina — Argentine Malbec styles", url: "https://blog.winesofargentina.com/destacadas/argentine-malbec-4-styles/" },
    ],
  });

  const cabernetFranc = await upsertEntry({
    topicKey: "variety",
    key: "cabernet-franc",
    title: "Cabernet Franc",
    locationLine: "El lado elegante y herbal de los tintos de Mendoza",
    teaser:
      "Tu vino es Cabernet Franc: acidez fresca, un toque de pimienta y taninos finos — el contrapunto elegante a la fruta madura del Malbec.",
    factChips: [
      { label: "Origen", value: "País Vasco / Burdeos, Francia" },
      { label: "Particularidad", value: "Padre genético del Cabernet Sauvignon y el Merlot" },
      { label: "Acidez", value: "Alta" },
      { label: "Taninos", value: "Finos, más suaves que el Cabernet Sauvignon" },
      { label: "Temperatura de servicio", value: "16–17 °C" },
      { label: "Marida bien con", value: "Pastas con salsas de hierbas, cordero" },
    ],
    narrative:
      "El Cabernet Franc llegó a Mendoza a fines del siglo XIX, pero durante mucho tiempo fue casi exclusivamente una uva de apoyo, pensada para sumarle acidez y frescura a mezclas con Malbec. Eso cambió en las últimas dos décadas: hoy zonas de altura del Valle de Uco, como Gualtallary, lo muestran como una cepa con identidad propia, capaz de dar vinos herbales, minerales y con buena capacidad de guarda. Se lo reconoce por su acidez marcada, un toque de pimienta y hierbas, y taninos más finos y suaves que los de su pariente más famoso, el Cabernet Sauvignon — un perfil más esbelto que, en altura, gana profundidad sin perder esa frescura característica.",
    sources: [
      { label: "This Day in Wine History — Cabernet Franc in Argentina", url: "https://thisdayinwinehistory.com/cabernet-franc-in-argentina/" },
      { label: "Wine with Seth — Cabernet Franc, Valle de Uco", url: "https://www.winewithseth.com/winewiki/cabernet-franc-valle-de-uco/" },
      { label: "Vines of Mendoza — An introduction to Argentina's Cabernet Franc", url: "https://www.vinesofmendoza.com/blog/2018/july/31/an-easy-introduction-to-argentina-s-cabernet-franc-1/" },
    ],
  });

  await upsertEntry({
    topicKey: "variety",
    key: "cabernet-sauvignon",
    title: "Cabernet Sauvignon",
    locationLine: "El clásico de estructura firme",
    teaser:
      "Tu vino es Cabernet Sauvignon: estructura firme y fruta negra concentrada, con la acidez que le regalan las noches frías de altura.",
    factChips: [
      { label: "Origen", value: "Cruza natural de Cabernet Franc y Sauvignon Blanc, Burdeos" },
      { label: "Cuerpo", value: "Pleno" },
      { label: "Taninos", value: "Firmes" },
      { label: "En Mendoza", value: "Concentrado en el Valle de Uco y Luján de Cuyo" },
      { label: "Temperatura de servicio", value: "17–18 °C" },
      { label: "Marida bien con", value: "Carnes rojas de cocción lenta, quesos curados" },
    ],
    narrative:
      "El Cabernet Sauvignon nació de un cruce espontáneo entre Cabernet Franc y Sauvignon Blanc en Burdeos, confirmado recién en los años 90 por análisis genético — y llegó a Mendoza en el siglo XIX junto con el Malbec, entre las variedades traídas para modernizar la vitivinicultura local. Es una cepa que se apoya en la amplitud térmica de la altura: el calor del día madura la fruta negra —cassis, ciruela— mientras el frío de la noche conserva la acidez que le da frescura. El resultado suele ser un vino de cuerpo pleno y taninos firmes, con buena capacidad de guarda, que en Argentina se usa tanto en vinos varietales como en mezcla con Malbec, al que le aporta la columna vertebral que a veces le falta.",
    sources: [
      { label: "The Argentino — History of Cabernet Sauvignon in Argentina", url: "https://theargentino.com/blogs/blog/history-of-cabernet-sauvignon-in-argentina" },
      { label: "Wine-Searcher — Cabernet Sauvignon / Malbec blend", url: "https://www.wine-searcher.com/grape-1728-cabernet-sauvignon-malbec" },
    ],
  });

  await upsertEntry({
    topicKey: "variety",
    key: "ancellotta",
    title: "Ancellotta",
    locationLine: "Una rareza italiana que suma color",
    teaser:
      "Tu vino tiene un toque de Ancellotta, una uva italiana poco conocida que aporta un color casi tinta a la mezcla.",
    factChips: [
      { label: "Origen", value: "Emilia-Romaña, Italia" },
      { label: "Rol principal", value: "Dar color — altísimo contenido de antocianinas" },
      { label: "En Argentina", value: "~2.400 ha, 85% en Mendoza (INV, 2022)" },
      { label: "Uso típico", value: "En mezcla, muchas veces junto al Merlot" },
    ],
    narrative:
      "El Ancellotta es una uva italiana de Emilia-Romaña, tradicionalmente usada en pequeñas proporciones dentro de mezclas de Lambrusco para darles más color. En Argentina es una variedad menor pero real: según cifras oficiales del INV, en 2022 había unas 2.400 hectáreas plantadas —la mayoría en Mendoza— y esa superficie viene creciendo con fuerza en la última década. No es una cepa pensada para lucirse sola: su piel altísima en pigmento la vuelve un color casi tinta, y por eso se usa sobre todo para sumarle profundidad y color a mezclas con otras variedades, más que como protagonista. Cuando aparece en tu vino, es en ese rol — un toque de intensidad, no la columna vertebral del vino.",
    sources: [
      { label: "Wikipedia — Ancellotta", url: "https://en.wikipedia.org/wiki/Ancellotta" },
      { label: "Uvas Argentinas — Ancellotta (datos INV)", url: "https://uvasargentinas.com.ar/uva-ancellotta-una-variedad-que-produce-mas-vinos-en-argentina/" },
      { label: "Vinerra — Ancellotta grape profile", url: "https://www.vinerra.com/education/grapes/ancellotta-an-in-depth-grape-profile" },
    ],
  });

  // --- Oak -------------------------------------------------------------

  const frenchOak = await upsertEntry({
    topicKey: "oak_origin",
    key: "french-oak",
    title: "Roble francés",
    teaser:
      "Tu barrica es de roble francés, de grano cerrado, que libera sus compuestos despacio: especias sutiles y taninos suaves que dejan que la fruta siga siendo la protagonista.",
    factChips: [
      { label: "Especie", value: "Quercus petraea (roble sésil)" },
      { label: "Bosques clásicos", value: "Allier, Nevers, Tronçais, Vosgos, Limousin" },
      { label: "Grano", value: "Cerrado y fino" },
      { label: "Secado", value: "Al aire libre, hasta 2–3 años" },
    ],
    narrative:
      "El roble francés para barricas viene sobre todo de Quercus petraea, criado en bosques con nombre propio —Allier, Nevers, Tronçais, Vosgos, Limousin— cada uno con una reputación algo distinta dentro del oficio. Su grano cerrado y fino obliga a partir la madera en vez de aserrarla, lo que rinde menos duelas por tronco y encarece el proceso, pero también hace que sus compuestos se liberen más despacio dentro del vino: especias finas, un toque de vainilla apenas insinuado, taninos que redondean sin endurecer. Es la elección clásica cuando se busca que la fruta y el origen del vino sigan siendo protagonistas — aunque el tueste, el secado y hasta el bosque específico también cambian bastante el resultado final, así que ningún roble francés se comporta exactamente igual a otro.",
    sources: [
      { label: "Wine with Seth — French oak forests", url: "https://www.winewithseth.com/winewiki/french-oak-forests/" },
      { label: "Lodi Wine — Oak barrels part 3: silviculture and seasoning", url: "https://www.lodiwine.com/blog/Oak-barrels--part-3---French-and-American-silviculture-and-oak-seasoning" },
      { label: "Decanter — Cooperage, the art of oak ageing", url: "https://www.decanter.com/features/cooperage-the-art-of-oak-ageing-245755/" },
    ],
  });

  await upsertEntry({
    topicKey: "oak_origin",
    key: "american-oak",
    title: "Roble americano",
    teaser:
      "Tu barrica es de roble americano, de grano más abierto, que libera sus aromas más rápido: notas de vainilla y coco bien presentes desde el principio.",
    factChips: [
      { label: "Especie", value: "Quercus alba (roble blanco)" },
      { label: "Origen principal", value: "Misuri y los montes Ozark, EE. UU." },
      { label: "Grano", value: "Más ancho y abierto" },
      { label: "Proceso", value: "Se puede aserrar — mayor rendimiento, menor costo" },
    ],
    narrative:
      "El roble americano usado en barricas es casi siempre Quercus alba, criado principalmente en Misuri y los montes Ozark. A diferencia del francés, su estructura permite aserrarlo en vez de partirlo, lo que rinde más duelas por tronco y explica buena parte de su menor costo. Es una madera con más compuestos del tipo lactona, asociados a notas de vainilla y coco que suelen sentirse más rápido y con más intensidad que en el roble francés — un perfil que muchos bodegueros eligen a propósito para vinos de cuerpo pleno y fruta concentrada, que pueden sostener ese carácter más expresivo sin quedar tapados por él.",
    sources: [
      { label: "World Cooperage — Oak species for cooperage", url: "https://www.worldcooperage.com/oak-species-for-cooperage/" },
      { label: "Wine Spectator — American vs. French oak", url: "https://www.winespectator.com/articles/whats-the-difference-between-american-oak-and-french-oak-for-barrel-aged-wines-42395" },
    ],
  });

  await upsertEntry({
    topicKey: "comparison",
    key: "french-vs-american-oak",
    title: "Roble francés vs. roble americano",
    locationLine: "Dos maderas, un mismo objetivo: acompañar al vino mientras madura",
    teaser:
      "Roble francés y roble americano no son mejor o peor entre sí — son dos formas distintas de acompañar el mismo vino mientras madura.",
    factChips: [
      { label: "Roble francés", value: "Más sutil · especias finas · estructura · integración gradual" },
      { label: "Roble americano", value: "Más expresivo · vainilla · coco · impresión aromática más dulce" },
      { label: "Lo que más cambia el resultado", value: "El tueste, la edad de la barrica y la variedad del vino" },
    ],
    narrative:
      "Es real que el roble francés y el americano tienden a comportarse distinto: el grano más cerrado del francés libera sus compuestos despacio, mientras el americano —con más compuestos de tipo lactona— suele dar notas de vainilla y coco más inmediatas. Pero conviene no convertir esa tendencia en una regla fija. La bibliografía técnica del oficio coincide en algo importante: el nivel de tueste, cuántas veces se usó la barrica, la variedad de uva y hasta el bosque específico del que salió la madera pesan tanto —a veces más— que el origen del roble en sí. Dos barricas francesas de distinto tueste pueden parecerse menos entre sí que una francesa y una americana con el mismo tueste. Por eso, más que preguntarse cuál roble es 'mejor', tiene más sentido pensar en qué estilo de vino se busca acompañar.",
    sources: [
      { label: "Wine Spectator — American vs. French oak", url: "https://www.winespectator.com/articles/whats-the-difference-between-american-oak-and-french-oak-for-barrel-aged-wines-42395" },
      { label: "ScienceDirect — Geographic origin and oak odorants (2021)", url: "https://www.sciencedirect.com/science/article/abs/pii/S0963996921006761" },
    ],
  });

  // --- Toast levels ------------------------------------------------------

  await upsertEntry({
    topicKey: "toast_level",
    key: "light-toast",
    title: "Tueste ligero",
    teaser:
      "El tueste ligero de tu barrica deja más carácter de madera cruda: aporta estructura y taninos, con menos transformación aromática.",
    factChips: [
      { label: "Efecto", value: "Más tanino de madera, menos vainilla" },
      { label: "Notas", value: "Madera fresca, especias verdes" },
      { label: "Uso típico", value: "Vinos que ya llegan con buena estructura propia" },
    ],
    narrative:
      "El tostado se logra exponiendo el interior de la barrica al fuego, y cuanto menos tiempo y calor recibe, menos se transforma la madera: un tueste ligero conserva más de su carácter crudo, con menos de la vainilla y el caramelo que aparecen a tuestes más altos, pero con buena presencia de taninos de madera. Se elige cuando el vino ya tiene personalidad propia y no hace falta que la barrica hable tan fuerte.",
    sources: [
      { label: "World Cooperage — Toasting chemistry", url: "https://www.worldcooperage.com/toasting-chemistry/" },
    ],
  });

  const mediumToast = await upsertEntry({
    topicKey: "toast_level",
    key: "medium-toast",
    title: "Tueste medio",
    teaser:
      "El tueste medio de tu barrica equilibra fruta y madera: vainilla y un caramelo suave, sin tapar lo que ya tiene el vino.",
    factChips: [
      { label: "Efecto", value: "Equilibrio entre fruta y madera" },
      { label: "Notas", value: "Vainilla, caramelo suave, especias" },
      { label: "Frente a tueste fuerte", value: "Menos humo y café tostado" },
    ],
    narrative:
      "El tostado de la barrica se decide con fuego, y es tan importante como la especie de roble: un tueste medio es, según buena parte de la bibliografía del oficio, el punto donde más se desarrollan los compuestos asociados a vainilla y caramelo suave, sin tapar la fruta del vino. Es probablemente el nivel más usado en vinos de calidad, precisamente por ese equilibrio.",
    sources: [
      { label: "World Cooperage — Toasting chemistry", url: "https://www.worldcooperage.com/toasting-chemistry/" },
      { label: "Decanter — Cooperage, the art of oak ageing", url: "https://www.decanter.com/features/cooperage-the-art-of-oak-ageing-245755/" },
    ],
  });

  await upsertEntry({
    topicKey: "toast_level",
    key: "medium-plus-toast",
    title: "Tueste medio-alto",
    teaser:
      "El tueste medio-alto de tu barrica suma notas de café tostado, chocolate y almendra — más presencia de madera, pensada para vinos de cuerpo pleno.",
    factChips: [
      { label: "Efecto", value: "Mayor impacto aromático de la madera" },
      { label: "Notas", value: "Café, chocolate, almendra tostada" },
      { label: "Uso típico", value: "Vinos concentrados, de cuerpo pleno" },
    ],
    narrative:
      "Un tueste medio-alto lleva la madera un paso más allá del equilibrio del tueste medio, hacia notas de café, chocolate y almendra tostada. No hay un estándar único entre tonelerías sobre qué temperatura y tiempo exactos definen este nivel — cada una tiene su propio protocolo — pero en general se reserva para vinos con buena concentración de fruta, capaces de sostener una presencia de madera más marcada sin perder el equilibrio.",
    sources: [
      { label: "Familia Morgan — Medium-plus barrel toast", url: "https://familiamorgan.com/learn/glossary/medium-plus-barrel-toast/" },
      { label: "World Cooperage — Toasting chemistry", url: "https://www.worldcooperage.com/toasting-chemistry/" },
    ],
  });

  await upsertEntry({
    topicKey: "toast_level",
    key: "heavy-toast",
    title: "Tueste fuerte",
    teaser:
      "El tueste fuerte de tu barrica prioriza humo y especias tostadas por sobre la dulzura de la vainilla — un perfil intenso, donde el calor transforma la madera por completo.",
    factChips: [
      { label: "Efecto", value: "Menos aromas dulces, más humo y especia" },
      { label: "Notas", value: "Humo, café, cacao amargo" },
      { label: "Particularidad", value: "El calor extremo llega a destruir compuestos presentes en tuestes más suaves" },
    ],
    narrative:
      "En el tueste fuerte, el calor prolongado no solo suma notas de humo, especias y cacao amargo: en algún punto también empieza a destruir compuestos —como parte de la vainilla que sí aparece en tuestes más suaves— que ya se formaron con el calor inicial. Es un recordatorio de que 'más tueste' no siempre significa 'más de todo': a este nivel se cambia dulzura por intensidad y carácter torrado, una decisión de estilo tanto como técnica.",
    sources: [
      { label: "World Cooperage — Toasting chemistry", url: "https://www.worldcooperage.com/toasting-chemistry/" },
    ],
  });

  // --- Aging bands ---------------------------------------------------------

  await upsertEntry({
    topicKey: "aging_band",
    key: "band-0-9-months",
    title: "Menos de 9 meses en barrica",
    teaser:
      "A esta altura de la crianza, tu vino recién empieza a conocer la madera: la fruta todavía manda y la barrica apenas se insinúa.",
    factChips: [
      { label: "Qué ocurre", value: "Primeros intercambios de oxígeno a través de la madera" },
      { label: "Aporte", value: "Taninos todavía firmes, madera apenas presente" },
      { label: "Por qué se controla", value: "Para decidir el ritmo del resto de la crianza" },
    ],
    narrative:
      "En los primeros meses dentro de la barrica, el vino recién empieza el lento intercambio de oxígeno que define la crianza: los taninos originales de la uva todavía se sienten firmes y la madera apenas asoma. Es una etapa donde se controla seguido, no porque algo esté mal, sino porque estos primeros meses marcan el ritmo de todo lo que sigue.",
    sources: [
      { label: "Winemaker's Research Exchange — Micro-oxygenation", url: "https://winemakersresearchexchange.com/learn/micro-oxygenation/" },
    ],
  });

  await upsertEntry({
    topicKey: "aging_band",
    key: "band-9-15-months",
    title: "9 a 15 meses en barrica",
    teaser:
      "A esta altura de la crianza, la lenta entrada de oxígeno a través de la madera ya redondeó los taninos y sumó las primeras capas de complejidad.",
    factChips: [
      { label: "Qué ocurre", value: "Micro-oxigenación lenta a través de la madera" },
      { label: "Aporte de la barrica", value: "Estructura, taninos más redondos, complejidad" },
      { label: "Por qué se controla", value: "Cada barrica evoluciona distinto" },
    ],
    narrative:
      "La madera de la barrica no es un contenedor cerrado: deja pasar oxígeno de a poco, y ese goteo lentísimo es lo que suaviza los taninos y añade las capas de aroma que un tanque de acero no puede dar. Nueve a quince meses es el rango en el que esa transformación suele asentarse — ni tan poco que quede verde, ni tan largo que la madera tape la fruta. Por eso se prueba de tanto en tanto: no hay una fecha fija, hay una barrica que hay que escuchar.",
    sources: [
      { label: "Winemaker's Research Exchange — Micro-oxygenation", url: "https://winemakersresearchexchange.com/learn/micro-oxygenation/" },
    ],
  });

  await upsertEntry({
    topicKey: "aging_band",
    key: "band-15-plus-months",
    title: "Más de 15 meses en barrica",
    teaser:
      "Con más de 15 meses en barrica, la madera ya está integrada casi del todo: lo que sigue de acá en más es paciencia, no más madera.",
    factChips: [
      { label: "Qué ocurre", value: "La barrica ya dio la mayor parte de lo que puede dar" },
      { label: "Aporte", value: "Integración total, textura más suave" },
      { label: "A tener en cuenta", value: "Pasado cierto punto, más tiempo no siempre suma" },
    ],
    narrative:
      "Pasados los 15 meses, una barrica ya entregó buena parte de lo que tiene para dar: la madera está integrada, los taninos se sintieron más suaves y lo que sigue pasa más por la paciencia que por la madera en sí misma. Las barricas también pierden capacidad de aportar sabor nuevo con cada uso — después de unos años se vuelven 'neutras' y siguen siendo útiles solo para el intercambio lento de oxígeno, no para sumar más carácter de roble. Por eso, a esta altura, más tiempo no siempre es mejor: depende de la barrica puntual y de hacia dónde se quiere llevar el vino.",
    sources: [
      { label: "Samsara Wine — New oak barrels vs. neutral oak barrels", url: "https://www.samsarawine.com/new-oak-barrels-vs-neutral-oak-barrels/" },
      { label: "Westgarth Wines — Oak and barrel maturation", url: "https://westgarthwines.com/blogs/news/oak-and-barrel-maturation-new-vs-old-barrels" },
    ],
  });

  // --- Curated grape × place pairings --------------------------------------
  // The hand-written high-value pairs. Everything else is synthesized on the
  // fly from teasers by composeWineNarrative() in src/lib/knowledge.ts.

  await prisma.knowledgePairing.upsert({
    where: { entryAId_entryBId: { entryAId: malbec.id, entryBId: agrelo.id } },
    update: {
      status: "published",
      narrative:
        "Agrelo está en el extremo norte de Luján de Cuyo, lo bastante cerca de la Cordillera como para sentirla: el mismo suelo pedregoso y pobre en materia orgánica que limita el vigor de la planta concentra la fruta, y la caída brusca de temperatura después del atardecer deja que la uva conserve acidez mientras termina de madurar. Esa combinación suele dar Malbec más firme y aromático que el de zonas más bajas y cálidas — y es buena parte de por qué tu barrica nació en este lugar.",
    },
    create: {
      entryAId: malbec.id,
      entryBId: agrelo.id,
      status: "published",
      narrative:
        "Agrelo está en el extremo norte de Luján de Cuyo, lo bastante cerca de la Cordillera como para sentirla: el mismo suelo pedregoso y pobre en materia orgánica que limita el vigor de la planta concentra la fruta, y la caída brusca de temperatura después del atardecer deja que la uva conserve acidez mientras termina de madurar. Esa combinación suele dar Malbec más firme y aromático que el de zonas más bajas y cálidas — y es buena parte de por qué tu barrica nació en este lugar.",
    },
  });

  await prisma.knowledgePairing.upsert({
    where: { entryAId_entryBId: { entryAId: cabernetFranc.id, entryBId: gualtallary.id } },
    update: {
      status: "published",
      narrative:
        "Gualtallary es, dentro de Mendoza, uno de los lugares donde el Cabernet Franc está mostrando su versión más interesante. La altura extrema y el suelo calcáreo —poco común en el resto de la provincia— tienden a frenar la maduración lo suficiente como para que la cepa conserve su acidez y su carácter herbal característico, en vez de perderlo bajo la fruta madura que domina en zonas más bajas. El resultado suele ser un vino más tenso y mineral, con esa nota de pimienta y hierba que distingue al Cabernet Franc cuando se lo deja ser él mismo.",
    },
    create: {
      entryAId: cabernetFranc.id,
      entryBId: gualtallary.id,
      status: "published",
      narrative:
        "Gualtallary es, dentro de Mendoza, uno de los lugares donde el Cabernet Franc está mostrando su versión más interesante. La altura extrema y el suelo calcáreo —poco común en el resto de la provincia— tienden a frenar la maduración lo suficiente como para que la cepa conserve su acidez y su carácter herbal característico, en vez de perderlo bajo la fruta madura que domina en zonas más bajas. El resultado suele ser un vino más tenso y mineral, con esa nota de pimienta y hierba que distingue al Cabernet Franc cuando se lo deja ser él mismo.",
    },
  });

  if (!DEMO) {
    console.log("Reference data ready (operation catalog + Knowledge Layer). Demo project skipped.");
    return;
  }

  // ---------------------------------------------------------------------
  // Customer + wine project — no login for the customer: their access is the
  // project's publicToken (the /wine/[token] URL), not an account.
  // ---------------------------------------------------------------------
  const customer = await prisma.customer.upsert({
    where: { email: "cliente.demo@example.com" },
    update: {},
    create: {
      name: "Cliente Demo",
      email: "cliente.demo@example.com",
      country: "Estados Unidos",
      createdById: owner.id,
    },
  });

  const startDate = date("2026-02-01");

  const project = await prisma.wineProject.upsert({
    where: { id: "seed-project-demo-malbec" },
    update: { publicToken: "demo-cs024" },
    create: {
      id: "seed-project-demo-malbec",
      publicToken: "demo-cs024",
      customerId: customer.id,
      name: "El Malbec Demo",
      variety: "Malbec",
      vintage: 2025,
      vineyard: "Finca Agrelo",
      origin: "Agrelo, Luján de Cuyo, Mendoza, Argentina",
      volumeLiters: 225,
      alcohol: 14.2,
      startDate,
      estimatedAgingMonths: 12,
      status: "aging",
      storyVisible: true,
      originKnowledgeKey: agrelo.key,
      varietyKnowledgeKey: malbec.key,
      createdById: owner.id,
    },
  });

  await prisma.customerStory.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      visible: true,
      text:
        "Empezó como una idea simple: guardar una barrica entera para las ocasiones que todavía no llegaron. No hay una fecha puesta — solo la idea de que, cuando llegue el momento correcto, quiero que haya algo mío esperando en Cinco Sentidos.",
    },
  });

  const stageDefs = [
    { name: "Llenado", sortOrder: 0, startedAt: startDate, completedAt: startDate },
    { name: "Crianza", sortOrder: 1, startedAt: startDate, completedAt: null },
    { name: "Trasiego", sortOrder: 2, startedAt: null, completedAt: null },
    { name: "Embotellado", sortOrder: 3, startedAt: null, completedAt: null },
  ];
  const stages: Record<string, { id: string }> = {};
  for (const s of stageDefs) {
    const existing = await prisma.projectStage.findFirst({
      where: { projectId: project.id, name: s.name },
    });
    stages[s.name] =
      existing ??
      (await prisma.projectStage.create({
        data: { projectId: project.id, ...s },
      }));
  }

  const barrel = await prisma.barrel.upsert({
    where: { number: "CS-024" },
    update: {},
    create: {
      projectId: project.id,
      number: "CS-024",
      type: "Barrica bordelesa 225L",
      brand: "Tonelería Nadalié",
      origin: "Roble francés",
      toastLevel: "medium",
      volumeLiters: 225,
      contents: "Malbec 2025",
      status: "filled",
      oakOriginKnowledgeKey: frenchOak.key,
      toastLevelKnowledgeKey: mediumToast.key,
    },
  });

  // ---------------------------------------------------------------------
  // Operation history — a mix of completed operations and one future task,
  // spanning from fill date to just past "today" for a believable timeline.
  // ---------------------------------------------------------------------
  const opDefs = [
    {
      type: "Llenado",
      stage: "Llenado",
      d: "2026-02-01",
      notes: "Ingreso del Malbec 2025 a la barrica CS-024.",
      customerVisible: true,
      completed: true,
    },
    {
      type: "Control organoléptico",
      stage: "Crianza",
      d: "2026-03-20",
      notes: "Fruta todavía muy presente, la madera recién empieza a asomar.",
      customerVisible: true,
      completed: true,
      featured: true,
      customerHeadline: "Así se ve tu barrica hoy",
      customerNote: "Pasamos por la cava a ver cómo va tu Malbec — todavía muy joven, con la fruta bien al frente.",
    },
    {
      type: "Análisis de laboratorio",
      stage: "Crianza",
      d: "2026-04-15",
      notes: "Parámetros dentro de lo esperado para esta etapa.",
      customerVisible: false,
      completed: true,
      lab: { ph: 3.6, totalSo2: 28, volatileAcid: 0.42, sensoryNotes: "Buen volumen, sin desvíos." },
    },
    {
      type: "Trasiego",
      stage: "Crianza",
      d: "2026-06-01",
      notes: "Trasiego de rutina para limpiar borras.",
      customerVisible: true,
      completed: true,
    },
    {
      type: "Control organoléptico",
      stage: "Crianza",
      d: "2026-08-10",
      notes: "La madera ya está integrada, aparecen notas de vainilla y especias.",
      customerVisible: true,
      completed: true,
      featured: true,
      customerHeadline: "Hoy probamos tu vino",
      customerNote: "La madera ya se integró del todo — aparecen notas de vainilla y especias sobre la fruta.",
    },
    {
      type: "Control organoléptico",
      stage: "Crianza",
      d: isoLocal(daysFromNow(33)),
      notes: "Próximo control antes de evaluar embotellado.",
      customerVisible: true,
      completed: false,
    },
  ];

  const createdOps: Record<string, { id: string }> = {};
  for (const op of opDefs) {
    // Pending tasks use a "N days from now" date, which shifts on every
    // reseed — match by type+pending instead of exact date so reseeding
    // moves the one pending task forward instead of piling up duplicates.
    const existing = await prisma.operation.findFirst({
      where: op.completed
        ? { projectId: project.id, operationTypeId: opTypes[op.type].id, date: date(op.d) }
        : { projectId: project.id, operationTypeId: opTypes[op.type].id, completed: false },
    });
    if (existing && !op.completed && existing.date.getTime() !== date(op.d).getTime()) {
      await prisma.operation.update({ where: { id: existing.id }, data: { date: date(op.d) } });
    }
    const created =
      existing ??
      (await prisma.operation.create({
        data: {
          projectId: project.id,
          stageId: stages[op.stage].id,
          barrelId: barrel.id,
          operationTypeId: opTypes[op.type].id,
          date: date(op.d),
          notes: op.notes,
          completed: op.completed,
          customerVisible: op.customerVisible,
          featured: "featured" in op ? Boolean(op.featured) : false,
          customerHeadline: "customerHeadline" in op ? (op.customerHeadline as string) : null,
          customerNote: "customerNote" in op ? (op.customerNote as string) : null,
          createdById: enologo.id,
        },
      }));
    createdOps[`${op.type}|${op.d}`] = created;

    if ("lab" in op && op.lab && !existing) {
      await prisma.labControl.create({
        data: { operationId: created.id, ...op.lab },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Media — feeds the automatic "Moments" system alongside featured
  // operations (see src/lib/moments.ts). The barrel portrait is attached to
  // the first featured control so that moment carries a photo.
  // ---------------------------------------------------------------------
  const mediaDefs = [
    {
      url: "/brand/barrel-portrait.jpg",
      caption: "Tu barrica, CS-024, en la cava.",
      d: "2026-03-20",
      operationKey: "Control organoléptico|2026-03-20",
    },
  ];
  for (const m of mediaDefs) {
    const existing = await prisma.mediaItem.findFirst({ where: { projectId: project.id, url: m.url } });
    if (!existing) {
      await prisma.mediaItem.create({
        data: {
          projectId: project.id,
          operationId: m.operationKey ? createdOps[m.operationKey]?.id : undefined,
          url: m.url,
          type: "photo",
          caption: m.caption,
          customerVisible: true,
          capturedAt: date(m.d),
          uploadedById: enologo.id,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Staff login: admin.demo@example.com / ${DEMO_PASSWORD}`);
  console.log(`Public barrel URL: /wine/${project.publicToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
