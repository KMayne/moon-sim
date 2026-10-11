/** Body surface maps (see public/textures/PROVENANCE.md). Equirectangular, centred on lon 0. */
export const TEXTURE_URLS = {
  earth: `${import.meta.env.BASE_URL}textures/earth_bluemarble_4k.jpg`,
  moon: `${import.meta.env.BASE_URL}textures/moon_svs_4k.jpg`,
} as const;
