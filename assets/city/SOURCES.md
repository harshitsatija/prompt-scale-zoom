# assets/city — sources and processing (level "city", real Bangalore)

All files are baked by the scripts in `v4/levels/city/*.py` (run in this order: build_dem, bake_buildings, bake_roads, bake_misc, bake_far, build_maps).
Local frame: metres, x east, z south (north = -z), origin = centroid of the OSM building at 141 4th Main Road, Indiranagar (12.97846 N, 77.64083 E approx.),
whole map rotated by -2.3 deg so that 4th Main Road runs exactly along +x. Ground plane = ctx.geom.GROUND.

| file | what | source | licence | fetched | processing |
|---|---|---|---|---|---|
| near_pts.i16, near_bld.bin | 20,000 real building footprints within 1.8 km (decimetre int16 rings; height, levels, kind, area) | OpenStreetMap via Geofabrik southern-zone extract (southern-zone-261004.osm.pbf, https://download.geofabrik.de/asia/india/southern-zone.html), `osmium extract/tags-filter/export` | ODbL 1.0, (c) OpenStreetMap contributors | 2026-10-06 | height from `height` / `building:levels` tags where present (~15 %), otherwise INFERRED from footprint area + landuse (see bake_buildings.py levels_for); her own building removed |
| mid_boxes.bin | ~104k real footprints 1.8-4.6 km as axis-aligned boxes (centre, size, height) | OSM, as above | ODbL | same | AABB in the rotated frame; heights inferred as above |
| grid.bin | 80 m cell grid over +-16.4 km: footprint coverage, mean height, max height (used for skyline towers) | OSM | ODbL | same | aggregation |
| roads_ways.bin, roads_pts.f32 | 51k real highway polylines (motorway..service) in 4 LOD tiers, widths by class/lanes/width tag | OSM | ODbL | same | Douglas-Peucker simplification (0.6 - 25 m by tier), tunnels dropped |
| misc.json | water polygons (lakes, Ulsoor, Bellandur ...), parks/forest/farmland, landuse, waterways, runways, railways (Namma Metro viaducts, Indian Railways), stations, places, 5.9k mapped trees, 3.6k street lamps | OSM | ODbL | same | multipolygon assembly by osmium export; area/distance filtered; RDP simplified |
| dem_coarse.i16, dem_fine.i16, dem.json | terrain elevation, +-120 km at ~310 m and +-38.9 km at 76 m, int16 decimetres relative to the origin elevation (907.6 m a.s.l.) | AWS Terrain Tiles (Terrarium, https://registry.opendata.aws/terrain-tiles/) zoom 9 and 11, built from SRTM / ASTER / other public-domain DEMs | public domain (see registry: SRTM, USGS 3DEP, ...) | 2026-10-06 | decode RGB->metres, resample to the rotated local frame |
| ground_near_color.jpg / ground_near_glow.png | 3072^2 ground raster, +-16.4 km (10.7 m/px): real building footprints, roads, landuse, parks, water, hillshade; night-glow map | derived from OSM + Terrarium above | ODbL (derived database) | same | build_maps.py (PIL) |
| ground_far_color.jpg / ground_far_glow.png | 2048^2, +-120 km (117 m/px): relief, major roads, parks/water within 60-70 km, town glow from footprint coverage | derived from OSM + Terrarium | ODbL | same | build_maps.py |
| raw/ | download caches (southern-zone.osm.pbf 558 MB, region extracts, GeoJSON-seq, DEM tiles) — NOT shipped, can be deleted | | | | |

References (not shipped) in `v4/refs/city/`: Wikimedia Commons photographs of Bangalore (aerial views, MG Road, Ulsoor lake, apartments), used only to compare look: file pages on commons.wikimedia.org, CC BY / CC BY-SA, authors per file page.

Known data gaps / honesty notes
* Building heights are real only where OSM carries `height` or `building:levels` (about 1 in 6 in Indiranagar); elsewhere they are inferred (documented in bake_buildings.py).
* OSM building coverage is excellent in the core, patchy in the outer wards; beyond +-16 km only a coarse footprint-coverage glow is used.
* Roads beyond 42 km: motorway/trunk/primary only (secondary to 70 km); no individual streets in towns outside Bangalore.
* Lake outlines and the Namma Metro viaduct are real OSM; viaduct height (9 m) and pillar spacing (32 m) are typical values, not surveyed.

Round 4: ground_*_glow.png now include Gaussian glow clusters at real tech-park / airport-terminal coordinates (Whitefield ITPL 12.9852N 77.7375E, Electronic City 12.8440N 77.6630E, Manyata 13.0476N 77.6200E, Embassy/Bellandur ORR 12.9360N 77.6965E, UB City, KIA terminal 13.1986N 77.7066E): positions from OSM/public knowledge, strengths are artistic.

## Round 5 patch
ground_near_color.jpg / ground_near_glow.png: a ~30x40 px smooth, smeared patch near (x 1890 m, z 245 m) was overwritten with a flat plot colour (48,43,84) plus light noise to remove the blurry stretched rectangle seen at z 3.6. Originals not kept in the repo.
