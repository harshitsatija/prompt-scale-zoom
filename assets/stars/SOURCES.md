# assets/stars — sources and processing (level "stars", z 13.6 .. 21.6)

All files are produced by `v4/levels/stars/build_data.py` (run once, offline; the browser only reads the compact outputs). Fetched 2026-10-06.

## Star catalogue (REAL)
| file | source | licence | what was done |
|---|---|---|---|
| `stars.bin` (kind 0 records) | **HYG Database v4.1** (`hygdata_v41.csv`, 119,626 rows) — https://github.com/astronexus/HYG-Database (David Nash / astronexus; merges Hipparcos, Yale Bright Star, Gliese) | CC BY-SA 4.0 | dropped Sol and the 10,225 rows without a parallax (dist = 100,000 pc placeholder) -> 109,400 stars. Kept 3-D position (x,y,z in pc), absolute magnitude, B-V colour index. Rotated equatorial J2000 -> ecliptic -> the shared EARTH frame (see `frame.json`). B-V -> temperature (Ballesteros 2012) -> blackbody RGB (Tanner Helland fit), saturation x1.35 and a slight lift toward the house palette. |
| `named.json` | same catalogue | CC BY-SA 4.0 | 52 named stars (Proxima, alpha Cen, Barnard's, Wolf 359, Sirius, Procyon, Vega, Betelgeuse, Rigel, Antares, Deneb ...) with frame position, distance (ly, as in HYG), abs. magnitude, spectral type. NOTE: HYG distances are used verbatim, so Betelgeuse reads 498 ly (Hipparcos 2007) and Deneb 1,412 ly (Hipparcos); literature values are 550-700 ly and ~2,600 ly. |
| `constellations.json` | HYG (Hipparcos ids of the star patterns of Orion and the Big Dipper, plus Cassiopeia/Crux/Cygnus kept in the file but not drawn) | CC BY-SA 4.0 | real 3-D end points of each stick-figure line |

## Procedural (NOT real data, flagged in `stars.bin` byte 3 of each RGBA record: 1 = disc continuation, 2 = cluster fill)
* **Disc continuation (96k stars, 260 pc - 4.8 kpc from the Sun)**: Monte-Carlo from a Milky Way density model — exponential disc (scale length 2.6 kpc, thin-disc scale height 300 pc, 12 % thick disc 900 pc, Sun 20 pc above the plane, R0 = 8.2 kpc) modulated by four trailing log-spiral arms (pitch 12 deg); luminosity function dN/dM ~ 10^(0.52 M) for -6.5 < M < 1.6; colours drawn from a hot/yellow/red mix. Positions are rotated with the real IAU galactic -> equatorial matrix so the disc lies in the true galactic plane. These stars are only meant to fill the volume where the catalogue is incomplete; they are not individual stars.
* **Cluster fill (3.1k stars)**: Plummer-like fills around the real centres of the Pleiades (RA 3h47m, Dec +24.1, 136 pc), Hyades (4h30m, +15.9, 47 pc) and the Orion Nebula Cluster (5h35m, -5.4, 412 pc). The real brighter members are already in HYG.
* **Oort cloud comets** (`levels/stars.js`, generated at load): 23.5k sparks, inner (Hills) cloud 1,200-20,000 AU flattened toward the ecliptic, outer cloud isotropic to 100,000 AU. The extents are the real ones; the individual points are illustrative (a real comet is invisible).
* Local Bubble shell: an ellipsoid (a = 100 pc toward l = 235 deg [the Canis Majoris tunnel], b = 52 pc) with mild noise; sizes after Lallement et al. 2003 / Zucker et al. 2022 (order of magnitude only).
* Heliopause lathe: the same profile (nose 121 AU, flank 142 AU, tail 420 AU) and nose direction (ecliptic lon 255.4, lat +5.1) as `levels/solar.js` so the handover at z ~ 14.3 is seamless.

## Nebula imagery (`neb/<id>.jpg`, `neb/<id>_haze.jpg`) — all via Wikimedia Commons
Each image was downscaled to <= 1024 px, background-subtracted, multiplied by a smooth edge/elliptical window so no rectangle shows, highlight-compressed, and tinted very slightly toward violet; `_haze` is a 160 px blurred copy of the same colours used as the diffuse halo. Physical size and position are from RA/Dec/distance (distances from the literature: Orion 1,344 ly, Pleiades 444 ly, Helix 655 ly, Horsehead 1,375 ly, Eagle 5,700 ly, Lagoon 4,100 ly, Rosette 5,200 ly, Carina 7,500 ly, Taurus MC 450 ly; angular -> physical widths 5-190 ly are approximate).
| id | Commons file | credit | licence |
|---|---|---|---|
| orion | Orion Nebula - Hubble 2006 mosaic 18000.jpg | NASA, ESA, M. Robberto (STScI/ESA) and the HST Orion Treasury Project Team | public domain |
| pleiades | Pleiades large.jpg | NASA, ESA, AURA/Caltech, Palomar Observatory | public domain |
| eagle | Pillars of creation 2014 HST WFC3-UVIS full-res denoised.jpg | NASA, ESA, Hubble Heritage Team (STScI/AURA) | public domain |
| helix | Helix Nebula.jpg | ESO | CC BY 4.0 |
| horsehead | Hubble Sees a Horsehead of a Different Color.jpg | NASA/ESA/Hubble Heritage Team | CC BY 4.0 (as listed on Commons) |
| carina | Carina Nebula.jpg | ESO/T. Preibisch | CC BY 4.0 |
| lagoon | Lagoon Nebula (ESO).jpg | ESO/S. Guisard | CC BY 4.0 |
| rosette | Rosette nebula s.jpg | Nick Wright (UCL) | public domain (as listed on Commons) |
| taurus | Taurus molecular cloud (eso1209eb).jpg | ESO | CC BY 4.0 |

## Other files
* `dso.json` — positions (pc, frame), physical widths, aspect, haze factors of the nebulae + `phi`.
* `frame.json` — the frame definition and the rotation the galaxy level should apply (see `requests/stars.md`).

## References kept for comparison (not shipped at runtime): `v4/refs/stars/` (Hubble/ESO nebula originals at 640 px, ESO 3-D map of the solar neighbourhood (eso0303c), Oort-cloud concept art, Local Bubble artist rendering).

## Round-3 additions (procedural / illustrative, in levels/stars.js)
* Oort comets raised to 40,000 sparks (same extents). Termination-shock lathe (nose 94 AU) and a faint bow-wave lathe (nose ~215 AU, illustrative; there is no strong bow shock) beside the heliopause. Sun-to-Voyager leader lines use the same radial distances as the labels (V1 172 AU, V2 144 AU, as in levels/solar.js).
* Local Bubble: smooth prolate ellipsoid with a mild polar flare (illustrative, ~300 ly across). Galactic disc: inner-disc sampling thinned and weights tone-mapped (procedural).

## Round-4 changes (levels/stars.js, levels/stars/shaders.js)
* **Voyager 1/2**: real ecliptic coordinates (V1 lon 255.8 lat +35.2, 172 AU; V2 lon 290.0 lat -37.2, 144 AU), real heliopause crossings (V1 Aug 2012 at 121.6 AU, V2 Nov 2018 at 119 AU; termination shock 94 AU / 84 AU). The marker on each probe's track sits where the track meets the drawn heliopause. Source: NASA/JPL Voyager mission pages (public domain).
* **Heliosphere**: nose 121 AU, termination shock 94 AU, tail ~420 AU, hydrogen wall ~215 AU (illustrative; IBEX found no strong bow shock). Rendered as three lathes in a cel ramp with rim light; 30 AU and 100 AU scale rings; every label anchored exactly on the silhouette.
* **Oort cloud** is no longer drawn as bright stars: a ray-marched column-density haze (outer isotropic cloud, density ~ r^-3.4 between ~9,000 and ~100,000 AU; inner/Hills disc 2,000-20,000 AU flattened to ~0.3 of the radius) plus 11.6k faint comet glints sampled from the same densities (PROCEDURAL, illustrative; real comets are invisible). The 1.6 ly outer radius (3.2 ly across) is marked with a faint ring. alpha Centauri (4.4 ly) is flagged at the screen edge when it is out of frame.
* **Clusters**: real HYG stars inside the Hyades (47 pc, r 9 pc: 160 stars), Pleiades (136 pc, r 8 pc: 10 stars), and Orion OB1 (hot luminous stars within 62 pc of the Orion Nebula at 412 pc: 63 stars) are tagged and drawn as a swarm of dots; the procedural fill (kind 2, see above) is thinned (Pleiades 1/3, Orion Nebula Cluster core 1/10) so the bloom pass does not blow out.
* **Orion complex**: ray-marched procedural gas volume (H-alpha pink, reflection blue, O III teal core, dust absorption), true size ~360 ly, enlarged only when it would be < 6 % of the frame; the Hubble image of the Nebula sits at its centre. PROCEDURAL; the shape is illustrative, the position (1,344 ly) is real.
* **Local Bubble**: irregular shell (prolate ellipsoid + lumps toward the Canis Majoris tunnel and the northern chimney, pinched by Sco-Cen / Ophiuchus / Taurus-Perseus), fresnel limb only, ~300 ly across the short axes and up to ~600 ly toward CMa (Lallement 2003, Zucker 2022; order of magnitude).
* **Milky Way glow**: analytic barred-spiral luminosity in the galactic plane (disc scale length 4 kpc, 27 deg bar of semi-major axis ~4 kpc, four log-spiral arms of pitch ~14.6 deg crossing the Sun's azimuth at 4.7 / 6.6 / 9.4 / 13.2 kpc, Scutum-Centaurus and Perseus major, Sagittarius and Outer minor, dust on the leading edges), 150k star points (some pink H II), rings at the Sun's galactocentric radius (8.2 kpc = 26,700 ly) and the 15.3 kpc disc edge (PROCEDURAL; layout after Churchwell 2009, Reid 2019).
* `_haze.png` (nebula glow textures) regenerated losslessly from `<id>.jpg` (the old 160 px JPEG haze showed 8x8 blocks when enlarged). The Orion constellation lines were removed (they pointed like an arrow along the line of sight).
