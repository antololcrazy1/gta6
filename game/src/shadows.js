// Real shadows for Vice Coast: one directional sun with a PCFSoft shadow
// map, sized to cover the neighbourhood around the player. The shadow
// camera follows the player so the map stays sharp where the action is,
// and the sun's direction follows the day cycle.
export function setupShadows(THREE, renderer, scene) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // An orthographic shadow frustum around the player, in world units.
  const span = 700;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 2;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0x8a7ad8, 0x3a2a1a, 0.55);
  scene.add(hemi);

  return {
    sun,
    hemi,
    // True while the sun is actually casting shadows.
    get sunCasting() {
      return sun.castShadow && sun.intensity > 0.05;
    },
    // Point the sun at the player and line it up with the day cycle.
    // The world is Z-up: x east-west, y north-south, z vertical.
    update(sunDir, playerX, playerY) {
      const d = sunDir;
      sun.position.set(playerX + d.x * 900, playerY + d.y * 900, Math.max(60, d.z * 900));
      sun.target.position.set(playerX, playerY, 0);
      sun.target.updateMatrixWorld();
      // At night the sun is down: dim it out instead of lighting from below.
      sun.intensity = d.z > 0 ? 0.6 + d.z * 1.1 : 0.08;
      hemi.intensity = d.z > 0 ? 0.55 : 0.22;
    },
  };
}
