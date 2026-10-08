/* cortex/shade.js: tissue materials = kit.toon (shared cel ramp) + (1) cut-face cap colour on back faces so anything sliced by the section plane
 * reads as solid, (2) a depth haze that fades tissue behind the section plane toward violet (real volumetric depth cue), (3) a slight tonal lift. */
export function makeShade(ctx) {
  const { T, kit } = ctx;
  const U = { uHaze: { value: new T.Color(0x232067) }, uDepthK: { value: 1 / (0.45 * 1e5) }, uHazeMax: { value: 0.82 }, uCapLift: { value: 0.22 }, uShr: { value: 1 }, uTop: { value: 1 }, uDim: { value: 0 }, uFogW: { value: 0 }, uFogG: { value: new T.Color(0xdba2ae) }, uFogM: { value: new T.Color(0xf3dfbd) } };
  const patch = (m, o) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uShr = U.uShr; sh.uniforms.uTop = U.uTop; sh.uniforms.uDim = U.uDim; sh.uniforms.uFogW = U.uFogW; sh.uniforms.uFogG = U.uFogG; sh.uniforms.uFogM = U.uFogM;
      sh.vertexShader = 'varying float vSY; uniform float uShr;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed *= uShr;\n#endif\n { vec4 lp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n lp = instanceMatrix * lp;\n#endif\n vSY = lp.y; }');
      sh.uniforms.uHaze = U.uHaze; sh.uniforms.uDepthK = U.uDepthK; sh.uniforms.uHazeMax = U.uHazeMax; sh.uniforms.uCapLift = U.uCapLift;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vSY; uniform float uTop; uniform float uDim; uniform float uFogW; uniform vec3 uFogG; uniform vec3 uFogM; uniform vec3 uHaze; uniform float uDepthK; uniform float uHazeMax; uniform float uCapLift;\nvoid main() {\n if (vSY > uTop) discard;')
        .replace('#include <opaque_fragment>', `
        #ifdef USE_CLIPPING_PLANES_X
        #endif
        vec3 baseCol = diffuseColor.rgb;
        if (!gl_FrontFacing) { outgoingLight = mix(outgoingLight, mix(baseCol, vec3(1.0, 0.96, 0.9), uCapLift) * ${o.capK || '1.0'}, 0.72); }
        #if NUM_CLIPPING_PLANES > 0
        float dcut = clippingPlanes[0].w - dot(vClipPosition, clippingPlanes[0].xyz);
        float hz = smoothstep(0.0, 1.0, dcut * uDepthK) * uHazeMax * ${o.haze === undefined ? '1.0' : o.haze.toFixed(3)};
        outgoingLight = mix(outgoingLight, uHaze, hz);
        #endif
        outgoingLight = mix(outgoingLight, uHaze, uDim);
        { float dd = -vSY; vec3 wc = mix(uFogG, uFogM, smoothstep(3.45e-3, 3.65e-3, dd)); outgoingLight = mix(outgoingLight, wc, uFogW); }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'cortexshade' + (o.capK || '') + (o.haze === undefined ? '' : o.haze);
    return m;
  };
  /** the standard tissue material. opts: vc (vertex colours), haze (0..1 scale), side */
  const tissue = (color = 0xffffff, o = {}) => patch(kit.toon(color, { cut: kit.cut.cortex ? 'cortex' : true, vc: !!o.vc, side: o.side || T.DoubleSide, glow: o.glow, glowK: o.glowK }), o);
  return { U, tissue, patch };
}
