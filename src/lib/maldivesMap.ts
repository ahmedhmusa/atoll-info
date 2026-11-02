// ---------------------------------------------------------------------------
// maldivesMap.ts — simplified outline of the Maldives atolls (traced from a
// reference map) used by the drug network "Map" view. Units: height 1000.
// Purely static geography; no operational data lives here.
// ---------------------------------------------------------------------------

export type AtollCode = 'HA' | 'HDh' | 'Sh' | 'N' | 'R' | 'B' | 'Lh' | 'K' | 'MLE' | 'AA' | 'ADh' | 'V' | 'M' | 'F' | 'Dh' | 'Th' | 'L' | 'GA' | 'GDh' | 'Gn' | 'S';

export const ATOLLS: { code: AtollCode; name: string }[] = [
  {
    code: "HA",
    name: "Haa Alifu"
  },
  {
    code: "HDh",
    name: "Haa Dhaalu"
  },
  {
    code: "Sh",
    name: "Shaviyani"
  },
  {
    code: "N",
    name: "Noonu"
  },
  {
    code: "R",
    name: "Raa"
  },
  {
    code: "B",
    name: "Baa"
  },
  {
    code: "Lh",
    name: "Lhaviyani"
  },
  {
    code: "K",
    name: "Kaafu"
  },
  {
    code: "MLE",
    name: "Malé (capital)"
  },
  {
    code: "AA",
    name: "Alifu Alifu"
  },
  {
    code: "ADh",
    name: "Alifu Dhaalu"
  },
  {
    code: "V",
    name: "Vaavu"
  },
  {
    code: "M",
    name: "Meemu"
  },
  {
    code: "F",
    name: "Faafu"
  },
  {
    code: "Dh",
    name: "Dhaalu"
  },
  {
    code: "Th",
    name: "Thaa"
  },
  {
    code: "L",
    name: "Laamu"
  },
  {
    code: "GA",
    name: "Gaafu Alifu"
  },
  {
    code: "GDh",
    name: "Gaafu Dhaalu"
  },
  {
    code: "Gn",
    name: "Gnaviyani"
  },
  {
    code: "S",
    name: "Seenu"
  }
];

export const MAP_W = 161.2;
export const MAP_H = 1000;

/** Outline shapes (several atolls can share one shape, e.g. Haa Alifu–Noonu). */
export const MAP_PATHS: string[] = [
"M33.3 2.5L31.7 5.5L32.5 8.9L36.3 11.8L43.1 14.4L45.2 16.9L45.6 19.8L49.4 24.5L52.8 24.9L55.7 22.4L55.7 17.7L57.4 13.5L57.4 10.1L55.3 7.2L48.1 3.4L44.3 0.0Z",
"M19.4 90.3L14.4 93.3L11.8 92.9L11.0 96.7L5.1 102.6L3.8 105.5L3.4 111.0L0.0 114.0L0.8 116.5L3.8 119.4L5.5 119.0L7.2 116.9L8.0 108.9L15.2 96.7L19.4 92.4Z",
"M84.4 18.1L80.2 21.9L77.2 21.9L73.9 23.6L72.2 25.3L70.1 30.4L66.7 33.8L62.0 33.8L58.2 35.0L54.0 33.3L51.9 35.0L50.2 38.0L51.1 41.4L50.6 45.6L46.0 50.6L44.3 54.9L41.4 58.2L41.4 63.7L43.1 68.4L40.9 70.9L44.3 75.6L42.2 81.0L44.3 97.1L48.1 99.6L54.4 100.5L56.6 103.4L59.1 117.8L57.8 123.2L62.5 128.3L65.0 138.9L71.3 143.1L74.7 148.1L77.7 160.8L77.2 166.3L78.1 169.2L85.7 178.5L89.5 181.5L94.1 190.4L97.5 192.5L101.7 192.9L105.9 192.0L111.0 189.1L113.5 184.4L115.2 176.4L122.8 169.2L124.1 166.3L120.7 159.5L113.5 153.2L111.8 150.3L105.1 150.3L102.1 149.0L98.8 145.2L95.8 137.6L95.8 130.0L98.3 122.0L98.3 119.0L92.4 113.1L90.7 105.1L86.5 101.3L86.1 99.6L78.9 97.9L70.1 92.9L65.4 86.9L66.3 76.0L65.0 73.0L65.0 69.6L68.0 65.0L69.2 56.6L70.9 55.3L75.1 54.4L76.0 51.1L80.6 47.7L81.9 43.1L84.8 37.6L91.2 33.3L90.7 31.2L87.8 28.7L87.8 21.1L85.7 18.1Z",
"M51.5 148.1L52.3 149.8L54.0 149.8L54.4 149.4L52.8 147.7Z",
"M55.7 157.0L53.2 157.0L50.6 158.7L50.2 162.5L46.4 164.6L46.4 168.0L38.8 175.6L38.4 184.0L40.1 192.0L37.1 195.0L35.5 200.5L32.1 205.5L32.9 206.4L35.5 206.4L36.7 207.7L37.1 212.3L41.8 219.1L41.4 227.1L39.7 229.6L40.1 231.3L46.4 229.2L51.1 225.8L56.1 224.1L62.9 219.5L64.2 216.5L63.7 190.4Z",
"M119.4 202.2L117.3 204.3L116.5 208.5L111.4 211.0L108.0 214.4L106.8 216.9L106.4 222.0L103.0 226.7L104.7 227.5L108.0 225.8L110.6 225.8L113.5 227.5L124.5 236.8L126.2 239.3L126.6 243.1L127.9 244.0L135.1 241.0L142.2 240.6L145.2 235.1L145.2 226.2L143.9 222.4L140.1 218.6L132.1 215.7L122.0 202.2Z",
"M70.9 231.3L66.3 226.2L61.6 226.2L55.3 230.9L45.2 234.2L46.4 235.1L67.5 235.1L70.9 233.0Z",
"M82.3 240.6L80.2 238.5L75.6 236.4L68.8 236.8L59.5 238.9L40.5 238.5L39.7 239.7L39.7 251.1L34.2 256.6L33.3 259.6L33.8 261.7L35.5 263.4L35.0 268.0L37.1 272.7L40.1 275.6L43.1 274.8L46.8 275.2L52.3 273.9L58.2 271.0L66.7 263.8L75.6 253.7L83.6 246.5L84.0 244.8Z",
"M108.9 289.1L108.9 291.6L109.7 292.5L116.5 292.5L125.4 290.4L124.9 288.7L122.4 286.6L116.9 284.5L111.8 285.7Z",
"M62.5 285.3L61.6 284.5L59.5 285.3L45.2 285.3L41.4 287.4L39.7 292.1L40.5 293.8L43.9 295.0L52.3 294.6L57.4 292.1Z",
"M55.7 314.4L54.0 315.7L54.0 316.6L55.3 317.4L57.0 316.6L57.0 315.3Z",
"M120.3 294.2L116.9 296.3L115.2 299.2L112.3 300.5L109.3 306.4L103.8 346.1L106.8 355.0L111.4 360.0L117.8 363.0L125.8 363.0L129.2 361.7L130.8 360.0L132.1 348.2L135.1 345.3L137.6 344.4L139.3 340.2L141.8 337.7L147.3 336.0L151.1 333.0L154.1 326.3L153.6 325.0L149.0 322.9L138.0 311.9L131.7 300.5L127.0 295.4L124.9 294.2Z",
"M63.7 330.1L61.2 329.2L58.7 330.5L55.7 330.5L54.4 332.2L55.3 336.8L56.6 337.7L61.2 337.7L63.7 334.7Z",
"M127.0 369.3L114.8 368.9L111.4 370.6L108.0 376.1L105.5 387.0L105.1 400.1L106.4 406.0L109.7 410.3L114.8 410.3L117.8 408.1L119.4 403.9L119.9 398.9L122.4 396.3L125.8 387.0L128.7 384.5L129.6 382.0L128.7 370.6Z",
"M32.5 333.0L30.8 333.9L26.2 340.6L26.6 349.9L21.9 360.0L21.5 388.7L23.2 391.3L23.2 395.1L21.1 401.0L21.9 411.5L19.0 415.3L19.0 416.6L23.2 422.1L24.5 434.7L26.6 438.5L31.7 439.0L35.9 441.9L40.5 442.3L45.6 440.2L51.1 436.0L55.7 427.1L56.1 422.1L58.2 416.2L58.2 404.3L56.1 391.7L56.1 363.4L53.6 356.6L53.2 351.2L44.3 342.3L42.2 336.8L38.0 333.9Z",
"M94.5 452.5L95.4 455.4L97.5 456.7L105.1 458.8L114.0 468.1L115.6 471.0L115.6 473.1L122.4 476.9L124.5 476.5L129.2 471.0L134.2 471.0L138.9 469.3L146.9 469.3L150.7 467.2L157.0 468.1L158.7 466.4L161.2 458.8L158.7 455.0L157.4 450.8L154.1 451.6L147.3 455.8L142.7 456.3L138.0 458.4L134.2 457.5L129.2 452.0L124.5 442.8L124.5 436.4L125.4 433.9L124.5 429.2L122.0 427.6L117.8 426.7L110.6 427.6L108.0 430.1Z",
"M111.4 482.8L111.4 485.4L114.0 487.5L117.3 487.1L120.3 484.5L119.9 483.3L116.1 481.6L112.7 481.6Z",
"M54.0 468.5L47.3 468.1L42.2 469.3L37.1 474.4L37.1 476.5L38.4 477.8L38.4 484.1L43.1 489.2L43.5 491.3L41.4 496.4L40.9 500.6L41.8 502.3L44.7 504.0L49.0 504.0L52.8 502.7L61.6 498.0L65.0 494.7L66.7 490.9L67.1 484.1L64.6 476.1L60.4 471.0Z",
"M145.2 503.1L135.5 503.1L127.0 495.5L122.4 493.8L115.2 493.8L110.6 495.9L109.7 497.2L110.6 501.4L110.6 516.2L108.5 536.0L108.5 544.0L109.7 547.8L111.4 549.1L114.4 548.7L115.6 547.4L116.9 541.5L119.9 538.6L125.8 536.0L135.9 533.9L136.3 526.3L141.0 520.4L142.2 516.6L141.8 509.0L145.6 505.2L146.0 504.0Z",
"M61.2 509.0L55.3 509.0L49.4 512.0L43.1 517.5L39.7 522.5L39.3 525.5L41.4 529.3L41.4 531.4L38.8 533.9L38.4 539.0L40.1 541.9L40.9 550.4L43.5 553.8L46.4 554.6L54.0 553.8L60.8 547.8L63.7 542.8L65.0 537.7L64.6 515.3L63.3 511.5Z",
"M99.6 579.1L92.0 579.9L79.8 574.0L71.8 572.7L62.0 575.7L54.0 580.3L49.4 585.8L48.1 590.9L50.6 593.9L50.6 596.8L49.0 601.0L51.1 603.6L53.6 604.8L54.0 612.4L56.6 617.9L59.9 620.4L64.6 622.1L71.8 621.7L74.7 619.2L83.6 615.8L90.3 608.6L102.6 601.0L106.4 596.8L107.2 590.1L106.4 587.9L101.7 584.6L101.3 581.6Z",
"M134.6 629.7L123.7 637.3L113.1 640.3L107.2 644.9L96.2 650.0L94.5 652.9L94.5 662.6L97.1 667.3L100.5 670.7L105.5 673.2L108.9 673.2L114.4 669.0L122.4 668.6L125.8 667.3L127.5 665.6L131.7 655.9L129.6 641.1L131.7 634.8L135.1 631.0Z",
"M107.2 787.6L102.6 788.8L99.2 787.2L96.7 787.2L91.6 791.8L85.3 795.2L88.6 800.2L97.1 807.0L97.1 809.1L92.4 814.2L86.1 817.5L82.7 820.5L76.8 820.5L72.6 826.8L64.2 832.7L62.9 836.1L64.2 851.7L67.1 856.0L66.3 860.2L67.1 864.0L86.9 879.2L93.3 877.1L107.2 867.4L115.6 867.4L121.1 865.2L124.9 859.3L131.7 856.4L133.4 854.7L134.2 851.7L134.2 845.0L128.3 829.8L125.4 826.4L121.6 825.1L118.2 821.8L118.6 809.1L116.5 800.7L111.8 792.2Z",
"M116.9 945.9L116.5 946.3L116.9 948.4L117.3 948.8L119.0 948.8L119.4 948.0L117.8 945.9Z",
"M73.8 981.5L72.4 984.4L72.9 987.8L76.8 992.7L77.3 995.1L81.2 999.5L86.0 999.5L91.4 993.2L91.9 986.8L93.8 983.4L91.4 981.5L88.0 981.5L81.6 985.9L79.2 986.3L76.3 982.4Z"
];

/** Where people living in each atoll are placed on the map. */
export const ATOLL_ANCHORS: Record<AtollCode, [number, number]> = {'HA': [69.6, 35.9], 'HDh': [55.3, 76.0], 'Sh': [76.6, 116.1], 'N': [100.0, 162.5], 'R': [50.5, 196.2], 'B': [56.1, 254.0], 'Lh': [126.4, 224.1], 'K': [124.3, 329.4], 'MLE': [128.0, 349.0], 'AA': [39.0, 365.1], 'ADh': [38.8, 417.8], 'V': [123.5, 453.8], 'F': [52.0, 485.1], 'M': [123.5, 518.0], 'Dh': [52.3, 532.0], 'Th': [75.3, 596.0], 'L': [114.4, 654.9], 'GA': [106.4, 814.6], 'GDh': [87.4, 856.8], 'Gn': [117.8, 947.5], 'S': [83.0, 989.1]};

export function atollName(code?: string): string {
  return ATOLLS.find((a) => a.code === code)?.name ?? 'Not set';
}

// Common island names -> atoll, used to fill in the atoll automatically.
// Names that exist in more than one atoll are left out (choose them manually).
const KNOWN: Record<string, AtollCode> = {
  // Kaafu
  hulhumale: 'MLE', male: 'MLE', 'malé': 'MLE', villingili: 'MLE', vilimale: 'MLE', hulhule: 'MLE', thilafushi: 'K',
  maafushi: 'K', thulusdhoo: 'K', dhiffushi: 'K', huraa: 'K', himmafushi: 'K', gulhi: 'K', kaashidhoo: 'K', gaafaru: 'K',
  // Alifu Alifu / Alifu Dhaalu
  rasdhoo: 'AA', ukulhas: 'AA', mathiveri: 'AA', feridhoo: 'AA', maalhos: 'AA', thoddoo: 'AA', himandhoo: 'AA', bodufolhudhoo: 'AA',
  mahibadhoo: 'ADh', dhangethi: 'ADh', dhigurah: 'ADh', maamigili: 'ADh', fenfushi: 'ADh', hangnaameedhoo: 'ADh', mandhoo: 'ADh', kunburudhoo: 'ADh', dhidhdhoo: 'HA',
  // Thaa
  veymandoo: 'Th', thimarafushi: 'Th', kinbidhoo: 'Th', hirilandhoo: 'Th', gaadhiffushi: 'Th', vilufushi: 'Th', madifushi: 'Th',
  dhiyamigili: 'Th', buruni: 'Th', burunee: 'Th', vandhoo: 'Th', kandoodhoo: 'Th',
  // others (atoll capitals and large islands)
  kulhudhuffushi: 'HDh', funadhoo: 'Sh', manadhoo: 'N', velidhoo: 'N', ungoofaaru: 'R', dhuvaafaru: 'R', eydhafushi: 'B', thulhaadhoo: 'B',
  naifaru: 'Lh', hinnavaru: 'Lh', felidhoo: 'V', keyodhoo: 'V', muli: 'M', nilandhoo: 'F', magoodhoo: 'F', kudahuvadhoo: 'Dh',
  fonadhoo: 'L', isdhoo: 'L', thinadhoo: 'GDh', gadhdhoo: 'GDh', fuvahmulah: 'Gn',
  hithadhoo: 'S', feydhoo: 'S', maradhoo: 'S', hulhudhoo: 'S', meedhoo: 'S',
};

export function guessAtoll(islandName: string): AtollCode | undefined {
  const k = islandName.trim().toLowerCase().replace(/[^a-zé]/g, '');
  return KNOWN[k];
}

/** Atoll for an island: the one chosen, else a guess from its name. */
export function islandAtoll(island?: { name: string; atoll?: string }): AtollCode | undefined {
  if (!island) return undefined;
  return (island.atoll as AtollCode | undefined) || guessAtoll(island.name);
}
