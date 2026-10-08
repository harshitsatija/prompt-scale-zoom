# person level sources (fetched 2026-10-06)

| file | source | author / licence | what was done |
|---|---|---|---|
| person.glb, person_meta.json | Blender "Human Base Meshes Bundle" v1.4.1, https://www.blender.org/download/demo-files/ (raw/hb.zip, raw/human-base-meshes-bundle-v1.4.1) | Blender Foundation, CC0 | Body/head/hands/feet/eyes/teeth base meshes fitted to a seated typing pose with a custom skeleton (levels/person/build/*.py, run in Blender/bpy); hair (strand cards + bun), glasses, earbuds, shirt, jeans built procedurally on the base; head cut along the midsagittal plane with skin/fat/bone/dura cap faces and an empty cranial cavity for the brain level; exported as glTF with skin weights (3.5 MB). |
| props/*.glb (small_wooden_table_01, painted_wooden_chair_02, desk_lamp_arm_01, book_encyclopedia_set_01, wooden_bookshelf_worn, painted_wooden_cabinet, potted_plant_02, calathea_orbifolia_01, ceiling_fan, wall_clock, throw_pillows_01, stationery_supplies, alarm_clock_01, tea_set_01) | Poly Haven, https://polyhaven.com/models (API https://api.polyhaven.com/files/<id>) | Poly Haven authors, CC0 | Downloaded glTF, textures downsized to <=1k, repacked to GLB (build/convert_props.py). |
| tex/wall, floor, linen, denim, shirt_stripes, hair_strands | Poly Haven textures beige_wall_002, wood_floor, rough_linen, denim_fabric, cotton_jersey/stretch_poplin | CC0 | resized/compressed; shirt stripes and hair strand alpha made in build/make_textures.py |
| Room shell, window, curtains, skyline, laptop (keys at 19.2 mm pitch), router, rug, chat UI screen | procedural (levels/person/*.js) | own work | The skyline and chat UI are canvas textures; no real Bangalore photo is used. |

Gaps: skyline is stylised procedural, not photographic; the router is a procedural box.

## Round 2 changes (2026-10-06)
- Head/neck section caps rebuilt (levels/person/build/caps2.py): 2 mm skin + 2.6 mm fat bands (offset curves), calvaria bone 6.5 mm with outer table / diploe / inner table, CSF layer, dura on the brain; nasal cavity with turbinates, sphenoid and frontal sinuses, hard + soft palate with uvula, tongue root, a smooth airway (nasopharynx -> oropharynx -> larynx with vocal folds -> trachea) lined with mucosa, epiglottis, hyoid, thyroid and cricoid cartilage, tracheal rings; cervical vertebrae sectioned one by one with discs and cord. All cross-sections are cut from the real meshes (skin, skull, C1-C7) at the midline; the airway/sinus/cartilage outlines are hand-authored splines placed relative to the real vertebral column and skin (no source mesh for them in the base bundle) - procedural.
- Hair and bun get cap faces (section of the hair shell). Hair strand texture smoothed.
- Pose: torso leans ~10 degrees forward, fingers arched (hand_dip 0, curl 36-41 degrees), wrists re-targeted so the keyboard stays at the same place relative to the head. Collar smoothed.
- Room: facade of the right wall rebuilt as real relief (levels/person/facade.js, procedural), metro train + viaduct moved into the window, wardrobe/chair/shelf use a posterised version of the Poly Haven textures, curtains flat colour with folds.

## Round 3 changes (2026-10-06)
- Midsagittal brain section placed 3 mm behind the head's section plane (levels/person/build/brainfill.py): outline = real cranial cavity cut from the skull mesh; corpus callosum, lateral ventricle, thalamus, fornix, brainstem, cerebellum with foliae, cingulate / parieto-occipital / calcarine sulci and gyral notches are hand-placed (procedural, standard midsagittal anatomy). The real brain mesh from the brain level covers this plane at z < -0.3, so the cavity is never an empty void.
- Shirt re-fitted closer to the body (thinner cloth offset, looser sleeves removed) and stripe pitch reduced 32 -> 22 mm; hair shell thinned (crown 10.5 -> 7.2 mm); collar/cuffs recoloured; shoes recoloured/inflated; hair cap faces lightened (no dark outline).
- Room: wainscot with dado rail and raised panels, hazier far skyline layers, stylised steam ribbons, cel-shaded teacup, screen callout moved clear of lamp/window.
