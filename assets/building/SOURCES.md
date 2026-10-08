# assets/building: sources and processing

Level `building` (z 1.0 .. 3.4): her apartment block, the street and the real neighbourhood. Everything under `levels/building/*.js` is built at load time from the data below plus procedural geometry.
Frame: HEAD frame, metres, x east, z south (north = -z), y up. Origin and rotation are the SAME as the `city` level (assets/city/city_meta.json: ll0 = [12.97519, 77.64254], rot = -0.0401 rad, so
4th Main Road runs exactly along +x at z = +19 m). The real OSM building at the origin (way 343454925, "141 4th Main Road", 20 x 26 m) is REPLACED by our 24 x 15 m block (x -12..12, z -12.5..2.5)
with a front forecourt out to the compound wall at z = 13.9.

| file | what | URL / source | author, licence | fetched | processing |
|---|---|---|---|---|---|
| osm_wide.json (2.7 MB, raw) | buildings, roads (primary..service), street-lamp and tree nodes, railways, water, parks in lat 12.9715..12.9853, lon 77.6335..77.6481 | Overpass API, https://overpass-api.de/api/interpreter (query in levels/building/build_osm.py history: way[building], way[highway~primary|secondary|tertiary|residential|trunk|service|unclassified], node[natural=tree], node[highway=street_lamp], way[railway|natural=water|leisure=park]) | OpenStreetMap contributors, ODbL 1.0 | 2026-10-06 | none (kept for reproducibility) |
| neighbourhood.json (0.3 MB) | the above projected to the local frame, radius 560 m: 2170 real footprints (with `building:levels`/`height` where tagged, ~15 %), 143 road centre-lines with class/name, 510 trees, 186 street lamps | derived by levels/building/build_osm.py | ODbL (derivative) | 2026-10-06 | equirectangular projection (kx = 111320*cos(12.9784 deg), ky = 110574), rotation -0.0401 rad, decimetre integers |
| (reference photos, not shipped) refs/building/apt1..4.jpg, rick1.jpg, street1..2.jpg | design references for facade, balconies, roof clutter, auto-rickshaw, street | Wikimedia Commons: "Hara Vijaya Heights, Bangalore Kanakapura road Apartment flat.JPG" (CC BY-SA 4.0), "Utopia Bangalore Apartment.JPG", "Parimala Winsome Apartment 8-22-2010.JPG", "An Apartment near Kundanahalli gate.JPG" (CC BY-SA 3.0), "Namma yatri Auto-rickshaw in Bangalore.jpg" (CC BY-SA 4.0), "Street view in Bangalore, India.jpg", "The Streets of Bangalore.jpg" | various, as listed | 2026-10-06 | looked at only; no pixels used |

## What is real and what is procedural
REAL: footprints, positions, road network and classes, tree and street-lamp positions, building-level tags where present, street names (4th Main Road), the metric size of vehicles (Bajaj RE 2.6 x 1.3 x 1.7 m, Activa 1.8 m, hatchback 3.85 m).
INFERRED (not in OSM): storeys for ~85 % of neighbours (seeded draw: G+1 10 %, G+2 24 %, G+3 34 %, G+4 22 %, G+5 7 %, G+6 3 %), colours, windows, roof clutter, shops and their signs.
PROCEDURAL (modelled by hand in code from photo references, no external mesh): the apartment block, balconies/railings/AC units/laundry, rooftop tanks, solar heaters, dishes, compound wall, gate, booth, poles and cables, street lamps, auto-rickshaws, scooters, cars, trees (rain-tree / gulmohar / coconut-like palm).
ART DIRECTION (changes to reality, deliberately): buildings on the south side of 4th Main Road within |x| < 40 m are capped to 2-3 storeys and street trees in the same corridor are omitted so the camera at low pitch can see her window; real OSM trees/buildings elsewhere are untouched.
Textures are canvas-baked at load time (plaster, asphalt with patches/potholes/cracks, concrete pavers, cement-block wall, facade tiles with lit windows, AC grille, shop signs with Kannada + English lettering).
No Poly Haven / Sketchfab mesh is used (the CC0 trees on Poly Haven are 200+ MB photoscans; the street/utility kits exceed the 25 MB budget).

## Round-2 additions (procedural, not real data)
- Infill houses (`buildInfill` in levels/building/hood.js): where OSM has no footprint within ~520 m of her block, G+1..G+4 houses are scattered deterministically (seeded hash), aligned to the nearest real road direction, keeping clearance from real roads, mapped buildings and tree stands. They exist only so unmapped plots do not read as empty land; they are NOT OSM data. Mapped OSM buildings, roads, trees and lamps are unchanged.
- Roof variety (hip sheet roofs on small mapped buildings, parapet heights, tank clusters) is a seeded procedural draw on top of the real footprints.
- Fixed a bug where neighbours' window glass/lit quads were written without the per-bay transform (all landed near the origin as one blown-out rectangle in her room).
