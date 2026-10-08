# cortex level: sources

All morphologies are real reconstructions downloaded from **NeuroMorpho.org** (REST API `https://neuromorpho.org/api/neuron/...`, SWC files from
`https://neuromorpho.org/dableFiles/<archive>/CNG%20version/<name>.CNG.swc`), fetched 2026-10-06. NeuroMorpho data are open access; each reconstruction is
attributed to its depositing lab / archive (table below; please cite the DOI/PMID and Ascoli et al. 2007, *Nat Rev Neurosci* 8:557). The Allen Cell Types Database
human neurons are published under the Allen Institute Terms of Use (CC-BY style attribution to the Allen Institute for Brain Science).

## files
- `morph.bin` + `morph.json` : the 30 reconstructions below converted by `v4/levels/cortex/convert.py`.
  Per node: x,y,z,r (float32, micrometres, soma centroid at origin; pyramidal cells rotated about z so the apical axis points +Y), parent index (int32), type (uint8: 1 soma, 2 axon, 3 basal dendrite, 4 apical dendrite).
  Processing: soma re-centred; apical axis aligned to +Y (pyramidal); axons truncated (120 um pyramidal, 380 um interneuron); chains simplified with Ramer-Douglas-Peucker (0.5 um tolerance);
  radii are re-derived at runtime from subtree size (Rall-like, r = 0.3 um * N_tips^0.43) because the deposited radii of the Allen slice reconstructions are uniformly thin.
  At runtime the apical trunk of each pyramidal template is stretched/compressed (`templates.js: fitCell`) so the tuft really ends in layer I from the layer the cell sits in.
- `raw.tgz` : the original SWC downloads and NeuroMorpho metadata JSON, compressed (not needed at runtime; `tar xzf raw.tgz` recreates `raw/` for `v4/levels/cortex/convert.py`).

## reconstructions used
| NeuroMorpho id | name | archive | species | region | class | reference |
|---|---|---|---|---|---|---|
| 102563 | H16-06-004-01-03-05_546790847_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102575 | H16-06-013-11-18-02_696537235_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102586 | H17-06-003-11-03-02_700233253_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102559 | H16-03-005-01-09-04_702296264_m | Allen Cell Types | human | primary visual,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102564 | H16-06-006-01-04-01_716317425_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102562 | H16-03-010-13-05-03_712796148_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102592 | H17-06-006-11-09-08_675799126_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102593 | H17-06-006-11-10-01_712559850_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102560 | H16-03-006-01-03-04_718251763_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102565 | H16-06-007-01-07-02_572837189_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102570 | H16-06-009-01-02-05-01_671465753_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102589 | H17-06-005-12-15-03_712844902_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102403 | H17-06-005-12-15-01_605485782_m | Allen Cell Types | human | neocortex,occipital,middle temporal gyrus | int | 10.1016/j.neuron.2016.10.019 |
| 102405 | H17-06-012-14-08-05_649667451_m | Allen Cell Types | human | neocortex,occipital,middle temporal gyrus | int | 10.1016/j.neuron.2016.10.019 |
| 102587 | H17-06-003-11-03-03_694168884_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | int | 10.1016/j.neuron.2015.02.022 |
| 102595 | H17-06-009-11-04-02_657984300_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | int | 10.1016/j.neuron.2015.02.022 |
| 102599 | H17-06-013-12-03-02_676466554_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | int | 10.1016/j.neuron.2015.02.022 |
| 102577 | H16-06-013-12-08-06_695330591_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | int | 10.1016/j.neuron.2015.02.022 |
| 102568 | H16-06-009-01-01-15-01_722014861_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102588 | H17-06-003-11-03-04_699538239_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102567 | H16-06-009-01-01-03-05_673459567_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102579 | H17-03-005-11-09-02_673700971_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 102566 | H16-06-007-01-07-03_709264598_m | Allen Cell Types | human | middle temporal gyrus,layer 2-3,right | pyr | 10.1016/j.neuron.2015.02.022 |
| 104770 | RealAstrocyteSkeleton1 | Rusakov | rat | hippocampus,CA1,stratum radiatum | astro | 10.1038/s41467-018-05896-w |
| 117262 | WT-astrocytes | Zheng | mouse | hippocampus,CA3 | astro | 10.1016/j.neuron.2018.10.031 |
| 117267 | PS19-astrocytes | Zheng | mouse | hippocampus,CA3 | astro | 10.1016/j.neuron.2018.10.031 |
| 106334 | wtsalF3068iba3_2 | Bilkei-Gorzo | mouse | hippocampus | micro | 10.3389/fnmol.2018.00295 |
| 106336 | wtsalF3035iba3_3 | Bilkei-Gorzo | mouse | hippocampus | micro | 10.3389/fnmol.2018.00295 |
| 131077 | Female-Nociceptin-Cell6 | Sato-Bigbee | rat | neocortex | oligo | 10.1002/glia.23799 |
| 131078 | Female-Nociceptin-Cell4 | Sato-Bigbee | rat | neocortex | oligo | 10.1002/glia.23799 |

Notes on honesty: no NeuroMorpho archive provides human layer-5/6 pyramidal cells with complete apical trunks, so the layer-5/6 cells are human layer-2/3 reconstructions with a lengthened trunk
(a real property of deeper pyramidal cells) and larger somata. Glia are NOT human reconstructions: protoplasmic astrocyte = Rusakov rat CA1 (104770); GFAP astrocytes = Zheng mouse; microglia = Bilkei-Gorzo mouse Iba1;
oligodendrocytes = Sato-Bigbee rat neocortex. Interneuron subtypes (basket / chandelier / Martinotti) are not annotated in the Allen records, so the cells are labelled only 'aspiny interneuron'.

## anatomical constants (procedural, from the literature, no files)
- Layer boundaries (depth, mm): I 0-0.15, II 0.15-0.38, III 0.38-1.30, IV 1.30-1.62, V 1.62-2.12, VI 2.12-2.70, white matter below (grey matter 2.7 mm, within the 2.5-3 mm human range; von Economo & Koskinas 1925; Rockel, Hiorns & Powell 1980; Hutsler 2005).
- Neuron density 4-80 thousand per mm3 by layer (human mean ~ 30-40k; Pakkenberg & Gundersen 1997; Carlo & Stevens 2013), glia roughly 1 : 1 (Azevedo et al. 2009), ~80 % pyramidal / 20 % GABAergic interneurons (Markram et al. 2004), minicolumn spacing ~50 um (Mountcastle 1997; Buxhoeveden & Casanova 2002).
- Capillary length density ~ 400 mm per mm3, lumen 5-7 um, red cells ~7.5 um biconcave (Evans-Fung profile); penetrating arterioles 25-40 um, pial arteries 100-150 um (Duvernoy et al. 1981; Reina-De La Torre 1998).
- Myelinated fibre layout after Gray's Anatomy fig. 754 (Plexus of Exner, bands of Bechterew and Baillarger, radial fibres, white medullary substance); reference image in `v4/refs/cortex/gray754.png` (Wikimedia Commons, public domain).

## what is procedural (no files): the runtime builds these from the constants above
- Section-plane back wall (`levels/cortex/wall.js`): fragment-shader painting. Layer tints / cell-presence probabilities / soma sizes per lamina follow the layer table; Baillarger bands, pia and white-matter striations are painted from the same constants. At fields < 0.3 mm it turns into a stylised electron-microscopy-like neuropil (rounded profiles, dark membranes, mitochondria, myelinated-axon rings): this part is an artistic rendering, not EM data.
- Cell field (`field.js`): ~650 k somata and glial nuclei placed by layer density and minicolumn lattice, instanced as nucleated meshes; the nearest ~15-60 pyramidal / interneuron somata at close fields are replaced by the real reconstructions above.
- Vasculature (`vessels.js`): pial artery/vein, 6 penetrating arterioles (smooth-muscle beading) and ascending venules, plus a capillary bed from a jittered 3-D lattice (5-7 um lumen, ~400 mm/mm^3, dead ends pruned, runs swept as single smooth tubes) with red blood cells (Evans-Fung biconcave profile) flowing along each run. Topology is generated, not traced from a real angiogram.
- Myelinated fibres (`fibres.js`): layout after Gray fig. 754 (see above), generated.

## Round-2 notes (no new external data)
All changes in round 2 are procedural/rendering only: face-on slab (the slab is turned about the focus by the camera yaw so its section plane faces the camera, pia up, with its own clip plane
`kit.cut.cortex`), laminar tint sheet + wave-front sheet on the section plane (wall.js), scale bracket (lamina.js), pyramidal soma LODs with tapering apical trunk, basal stubs and an apical tuft,
multipolar interneuron stubs, matte darker nuclei, thinner opaque capillaries with biconcave red cells riding the thread, no horizontal fibre lattice at wide fields. Real NeuroMorpho reconstructions
(morph.bin) are unchanged. Known gap: the isolated (--only=cortex) 40 um frame draws its own focal cell (no organelles); in the full film the neuron level supplies the hero.

## round-2 revision notes (procedural, no new data)
Layer tints are density-smoothed gradients; spines, mitochondria, Nissl granules, endothelial nuclei and the pial top face are procedural; glia/interneuron shapes use the NeuroMorpho
reconstructions listed above. Known gaps: the pia is flat (no gyral curvature), neuropil background at 40 um is procedural.
