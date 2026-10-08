/* LEVEL person (z -0.7 .. 1.6): a young woman typing a prompt in her flat in Bangalore at 11 pm. HEAD frame, anchor [0,0,0]. See assets/person/SOURCES.md. */
import { buildHuman } from './person/human.js';
import { buildLaptop } from './person/laptop.js';
import { buildRoom, ROOM } from './person/room.js';
export default async function build(ctx) {
  const { T, kit, timeline } = ctx; ctx.timeline = timeline;
  const group = new T.Group(); group.name = 'person';
  const capPlane = new T.Plane(new T.Vector3(0, 0, -1), -0.0010);
  ctx.log('person: build'); const human = await buildHuman(ctx, capPlane); group.add(human.root); ctx.log('person: human done');
  const laptop = buildLaptop(ctx); laptop.group.position.set(0.287, -0.4705, 0); group.add(laptop.group);
  // magnified callout of her screen: the laptop faces her, so from the side it is edge-on; a camera-facing card shows what she is reading
  const callout = new T.Group(); callout.name = 'screenCallout'; group.add(callout);
  { const cw = 0.21, chh = cw * 0.625; const m = new T.MeshBasicMaterial({ map: laptop.scr.tex, toneMapped: false, fog: false }); m.color.setScalar(1.12); const sc = new T.Mesh(new T.PlaneGeometry(cw, chh), m); sc.position.z = 0.003; callout.add(sc);
    const edge = new T.Mesh(new T.PlaneGeometry(cw + 0.012, chh + 0.012), new T.MeshBasicMaterial({ color: 0xffd166, fog: false })); edge.position.z = 0.001; callout.add(edge);
    const bez = new T.Mesh(new T.PlaneGeometry(cw + 0.006, chh + 0.006), new T.MeshBasicMaterial({ color: 0x0b0d2e, fog: false })); bez.position.z = 0.002; callout.add(bez);
    callout.position.set(0.40, 0.165, 0.10);
    // leader: from the laptop lid (its screen faces her, edge-on to us) up to the inset's lower-left corner
    const lineG = new T.BufferGeometry().setFromPoints([new T.Vector3(0.47, -0.31, 0.02), new T.Vector3(0.40 - cw / 2, 0.165 - chh / 2, 0.10)]); const leader = new T.Line(lineG, new T.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, fog: false })); group.add(leader); callout.userData.leader = leader;
    callout.userData.name = 'callout'; }
  const cw0 = 0.21; const only = ctx.params.get('parts'); let room = null;
  if (only !== 'human') room = await buildRoom(ctx, group, human); ctx.log('person: room done');
  const V = (a) => new T.Vector3(a[0], a[1], a[2]);
  const labels = [
    { text: 'She types “Why is the sky blue?”', z0: -0.1, z1: 0.55, pos: () => V([0.02, 0.19, 0]), right: true, amber: true },
    { text: 'Her screen, magnified', z0: -0.1, z1: 0.6, pos: () => V([0.40 - cw0 / 2 - 0.01, 0.165 + 0.075, 0.10]), right: true },
    { text: 'Laptop · 23:02 in Bangalore', z0: 0.5, z1: 1.2, pos: () => V([0.55, -0.27, -0.05]), right: false },
    { text: 'Her head, cut along the midline: skin and fat 5 mm, skull 6 mm, then brain', z0: -0.7, z1: 0.2, pos: () => V([-0.06, 0.07, 0]) },
    { text: 'Wi-fi router', z0: 0.3, z1: 1.6, pos: () => V([-1.52, 0.36, -1.78]), right: true },
    { text: 'Her flat · fourth floor', z0: 0.5, z1: 1.6, pos: () => V([-2.0, 1.5, -2.3]) } ];
  function update(t, S, z, c) {
    group.updateMatrixWorld(true);
    { const k = 1 - kit.ss(0.55, 0.95, z); callout.scale.setScalar(Math.max(k, 1e-3)); callout.visible = k > 0.01; if (callout.userData.leader) callout.userData.leader.visible = k > 0.01; }
    const peel = kit.ss(0.35, 1.1, z) * 0.35;
    capPlane.normal.set(0, 0, -1); capPlane.constant = -0.0010 + peel; capPlane.applyMatrix4(group.matrixWorld);
    try { human.update(t, S, z, c); laptop.update(t, S); if (room) room.update(t, S, z, c); } catch (e) { if (!update.err) { update.err = 1; console.error('PERSON_UPDATE_ERR ' + e.stack.split('\n').slice(0, 4).join(' | ')); } }
  }
  return { group, anchor: [0, 0, 0], labels, update, nestR: 2.0 };   // region = the room (not a 4.5 m ball): the building level keeps drawing the flat's exterior around the room while zooming in
}
