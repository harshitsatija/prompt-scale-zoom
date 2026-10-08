# assets/earth — sources and processing (level "earth": planet, Moon, satellites)

Everything here is baked by the scripts in `v4/levels/earth/build/` (run: `python3 earth_dl.py` -> `python3 models.py` -> `python3 convert.py`; set `EARTH_RAW=<dir>` to keep the ~100 MB of raw downloads out of the project).
All fetched 2026-10-06. Frame conventions are in `levels/earth/frame.js` (EARTH frame: +y = up at Bangalore 12.9716 N 77.5946 E, -z north, +x east).

| file | what | source (URL) | author / licence | processing |
|---|---|---|---|---|
| day_global.jpg (4096x2048) | global colour map | NASA Blue Marble Next Generation, via GIBS WMS `BlueMarble_NextGeneration` (https://gibs.earthdata.nasa.gov, https://visibleearth.nasa.gov/collection/1484) | NASA Earth Observatory / GSFC, public domain | 8192x4096 download, resized; ocean pixels re-graded (see below) |
| day_reg.jpg (4096x3891) | 60-100 E, 2-40 N colour (500 m native) | same layer, regional request | NASA, public domain | ocean re-grade only |
| day_loc.jpg (2048^2) | 75.4-79.8 E, 10.8-15.2 N colour | Blue Marble NG (low frequencies, cloud-free) + MODIS Terra true colour 2025-02-20 (GIBS `MODIS_Terra_CorrectedReflectance_TrueColor`, 250 m) as a clamped high-pass; cloud patches masked out | NASA, public domain | pan-sharpen style merge (convert.py `local`) |
| night_global.png, night_reg.png, night_loc.png | city lights | NASA VIIRS Black Marble (2016 composite) via GIBS `VIIRS_Black_Marble` | NASA/NOAA Suomi NPP, public domain | warm, bright pixels isolated (the dark-blue floor is dropped), stored as linear amber intensity |
| night_blr.png (4096^2 RGB, ~61 m/px, 76.5-78.8 E, 11.9-14.1 N) | R: real OSM road network (class-weighted, antialiased) + building-coverage glow; G: lakes/tanks/rivers; B: parks/forest | rasterised directly from the city level's baked OSM data (assets/city/roads_*.bin, raw/far_cov.npy, misc.json) by `build/blr_hires.py` | (c) OpenStreetMap contributors, ODbL 1.0 (derived database) | polylines drawn at 2x supersampling; G/B carve the dark water bodies and parks out of the VIIRS glow in the shader |
| nrm_global.jpg, nrm_reg.jpg, nrm_loc.jpg | relief: R = east slope, G = north slope, B = water mask | AWS Terrain Tiles (Terrarium, https://registry.opendata.aws/terrain-tiles/), zoom 4 (global), 7 (regional), 9 (Bangalore) | built from SRTM, ASTER, GEBCO bathymetry, USGS 3DEP...; public domain / open (see registry) | Mercator tiles decoded to metres, re-projected to lat/lon, slopes (dh/dx) encoded; water mask from Blue Marble colour + depth |
| mesh_global.h16, mesh_reg.h16, mesh_loc.h16 | per-vertex heights (Int16 metres, row major N->S) of the three displaced meshes (0.7 deg, 0.08 deg, 0.01 deg) | same Terrarium tiles | same | box-filtered; fades to 0 at the edge of each patch; flattened to the smooth sphere within 10-45 km of Bangalore and sunk 150 m under the city level's ground |
| clouds.jpg (8192x4096) | soft cloud density (real weather of 27-29 Sep 2026) | NASA MODIS Terra + Aqua daily global true colour (GIBS), 6 mosaics | NASA, public domain | `build/clouds_soft.py`: graded whiteness above the Blue Marble base (no binary threshold); soft best-nadir composite (each pixel weighted by its distance from any swath edge, so the straight swath-gap wedges and the tan sun-glint bands vanish); mip-mapped; shader adds fbm detail only below the data scale |
| moon.jpg (2048x1024) | Moon albedo | NASA/GSFC/Arizona State Univ. LRO WAC global mosaic 303 ppd v02 (via https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02) | NASA LRO / LROC, public domain | z3 tiles stitched, polar rows faded, contrast levels, warm-grey tint (the WAC mosaic is monochrome; the tint is mine) |
| models/iss.glb | International Space Station | NASA 3D Resources, "International Space Station (ISS) (B)" (https://github.com/nasa/NASA-3D-Resources) | NASA, public domain | Draco decoded, decimated 174k -> 19k tris (models.py) |
| models/ssl1300.glb | Space Systems Loral SSL-1300 comsat bus (GEO) | NASA 3D Resources | NASA, public domain | 182k -> 16k tris |
| models/tdrs.glb | TDRS relay satellite (GEO) | NASA 3D Resources "TDRS (A)" | NASA, public domain | as-is minus invisible bounding mesh |
| models/goes.glb | GOES weather satellite (GEO) | NASA 3D Resources | NASA, public domain | 41k -> 4k tris |
| meta.json | atlas boxes, Bangalore DEM height (911.7 m) | derived | - | - |

## What is real and what is procedural
Real: coastlines, colours, relief and bathymetry, city lights and the road network around Bangalore, the cloud pattern, the Moon surface, all spacecraft meshes, orbit geometry (ISS 408 km / 51.6 deg / 92.7 min; GEO 42,164 km in the equatorial plane at real-ish longitudes; Moon 384,400 km, R 1,737.4 km; Earth R 6,371 km), the Moon/Earth/sun geometry.
Procedural / illustrative: fine cloud and city-light detail (fbm noise below the data resolution, added only where a screen pixel is smaller than the source texel), the Starlink-like 72x22 shell (positions are a plausible Walker pattern, not TLEs), the exact ISS phase, the GEO satellite longitudes, the Moon's tint, the sun direction (see below), the data-centre location (Singapore hub, illustrative), the exaggerated atmosphere thickness (80 km shell, 12 km scale height).
Ocean colour: Blue Marble's ocean is nearly black; water pixels are re-graded from real GEBCO/SRTM+ bathymetry (smoothed, because Terrarium's sea floor is blocky) to indigo (deep) and palette teal (continental shelves).

## Known data gaps
* Terrarium's bathymetry is coarse (blocky at ~20 km in places) so shelf edges are approximate; no individual atolls.
* The WAC mosaic is grey-scale (no LROC colour), no lunar topography (the Moon is a textured sphere).
* Blue Marble is a 2004-era land-cover composite; MODIS high-pass only around Bangalore.
* VIIRS Black Marble in GIBS is a tone-mapped product: metro cores are saturated, so city cores below 160 m/px come from the OSM glow raster and above 400 m/px from VIIRS.
* Sun direction is now the real one for 23:02 IST on 6 Oct (sub-solar lat -5.6, lon -83): Arabia, East Africa and the Indian Ocean are in night.
* night_reg.png was rebuilt (levels/earth/build/night_reg_smooth.py) from the same GIBS request with the coarse source grid dissolved (gaussian); relief at night is a faint skyshine hillshade from the Terrarium slopes.
* The extra GEO comsats (21 total, spread around the whole belt) use the 3 NASA models; their longitudes are illustrative.

## mesh_reg.h16 / mesh_loc.h16 under Bangalore (patched)
levels/earth/build/patch_city_relief.py replaced the flattened/sunk heights inside the city level's +-120 km DEM square by hBLR + the city level's relief(x, z) (assets/city/dem_*.i16, AWS Terrarium/SRTM), blended back to the original over 95..118 km, so the city terrain and the Earth mesh agree to ~6 m.
