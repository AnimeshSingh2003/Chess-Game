import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import * as THREE from 'three';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Colors per board theme for the 3D tiles
const THEME_TILE_COLORS = {
  'neon-cyber':   { light: 0x4a5c8a, lR: 0.55, dark: 0x0c0c1c, dR: 0.85 },
  'classic-wood': { light: 0xf0d9b5, lR: 0.80, dark: 0xb58863, dR: 0.75 },
  'glass':        { light: 0x263548, lR: 0.15, dark: 0x0a0d14, dR: 0.25 },
  'midnight':     { light: 0x3f3f5a, lR: 0.60, dark: 0x1a1a2e, dR: 0.90 },
};

export default function ARPanel({
  engine, onMove, selectableColor = null, flipped = false,
  enableAR = false, boardApiRef, boardTheme = 'neon-cyber',
  statusText = '', isGameOver = false, onReset,
  moveHistory = [], showHistory = false, onToggleHistory,
  hintLoading = false, onRequestHint,
  onExitAR,
}) {
  const mountRef    = useRef(null);
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef   = useRef(null);
  const sceneOpsRef = useRef(null);
  const engineRef   = useRef(engine);
  const onMoveRef   = useRef(onMove);
  const selectableColorRef = useRef(selectableColor);
  const selectedRef = useRef(null);

  // Refs for tile materials — needed to update them from outside the mount effect
  const matLightRef = useRef(null);
  const matDarkRef  = useRef(null);
  const boardThemeRef = useRef(boardTheme);

  const [arActive, setArActive]     = useState(false);
  const [arStatus, setArStatus]     = useState('');
  const [selectedSq, setSelectedSq] = useState(null);

  useEffect(() => { engineRef.current = engine; sceneOpsRef.current?.refreshPieces(); }, [engine]);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { selectableColorRef.current = selectableColor; }, [selectableColor]);

  // Apply board theme to 3D tile materials when theme prop changes
  useEffect(() => {
    boardThemeRef.current = boardTheme;
    const ml = matLightRef.current;
    const md = matDarkRef.current;
    if (!ml || !md) return;
    const c = THEME_TILE_COLORS[boardTheme] || THEME_TILE_COLORS['neon-cyber'];
    ml.color.setHex(c.light); ml.roughness = c.lR; ml.needsUpdate = true;
    md.color.setHex(c.dark);  md.roughness = c.dR; md.needsUpdate = true;
  }, [boardTheme]);

  // Add/remove body class so CSS can hide header/nav when AR is fullscreen
  useEffect(() => {
    if (enableAR) {
      document.body.classList.toggle('ar-fullscreen', arActive);
    }
    return () => { if (enableAR) document.body.classList.remove('ar-fullscreen'); };
  }, [arActive, enableAR]);

  // Resize renderer/camera when AR goes fullscreen
  useEffect(() => {
    requestAnimationFrame(() => {
      const m = mountRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!m || !renderer || !camera) return;
      const W = m.clientWidth  || (arActive ? window.innerWidth  : 380);
      const H = m.clientHeight || (arActive ? window.innerHeight : 340);
      if (W > 0 && H > 0) {
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      }
    });
  }, [arActive]);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      document.body.classList.remove('ar-fullscreen');
    };
  }, []);

  // Three.js scene — runs once on mount
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    const isMobile = window.innerWidth < 768 || window.devicePixelRatio > 1.5;
    const SEG = isMobile ? 8 : 12;
    let W = mount.clientWidth || 380;
    let H = isMobile ? Math.min(W, 340) : Math.min(W, 420);
    const TILE = 0.052;
    const BOFF = -TILE * 4 + TILE / 2;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: enableAR,
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(W, H);
    if (enableAR) { renderer.setClearColor(0x000000, 0); renderer.autoClear = true; }
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = enableAR ? null : new THREE.Color(0x080c14);

    const camera = new THREE.PerspectiveCamera(62, W / H, 0.01, 20);
    cameraRef.current = camera;
    let orbitTheta = flipped ? Math.PI : 0;
    let orbitPhi   = 0.82;
    const orbitRadius = 0.68;

    function updateCameraFromSphere() {
      camera.position.set(
        orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
        orbitRadius * Math.cos(orbitPhi),
        orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
      );
      camera.lookAt(0, 0.01, 0);
    }
    updateCameraFromSphere();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223366, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(1, 2.5, 1.5); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4488cc, 0.4);
    fill.position.set(-1, 1, -1.5); scene.add(fill);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const boardW = TILE * 8 + 0.01;
    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(boardW, 0.009, boardW),
      new THREE.MeshStandardMaterial({ color: 0x131825, roughness: 0.85 })
    );
    boardBase.position.set(0, -0.0045, 0);
    boardGroup.add(boardBase);

    // Apply initial theme colors
    const initTheme = THEME_TILE_COLORS[boardThemeRef.current] || THEME_TILE_COLORS['neon-cyber'];
    const MAT_LIGHT = new THREE.MeshStandardMaterial({ color: initTheme.light, roughness: initTheme.lR, metalness: 0.12 });
    const MAT_DARK  = new THREE.MeshStandardMaterial({ color: initTheme.dark,  roughness: initTheme.dR });
    matLightRef.current = MAT_LIGHT;
    matDarkRef.current  = MAT_DARK;

    const MAT_SEL       = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.4 });
    const MAT_LEGAL     = new THREE.MeshStandardMaterial({ color: 0x00ee66, emissive: 0x00ee66, emissiveIntensity: 0.25 });
    const MAT_HINT_FROM = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 0.5 });
    const MAT_HINT_TO   = new THREE.MeshStandardMaterial({ color: 0x44ffcc, emissive: 0x22ddaa, emissiveIntensity: 0.35 });
    const MAT_CHECK     = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff1122, emissiveIntensity: 0.6 });
    const MAT_W         = new THREE.MeshStandardMaterial({ color: 0xdde8f0, roughness: 0.35, metalness: 0.25 });
    const MAT_B         = new THREE.MeshStandardMaterial({ color: 0x20202e, roughness: 0.35, metalness: 0.3 });
    const MAT_W_SEL     = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd733, emissiveIntensity: 0.5, roughness: 0.3 });
    const MAT_B_SEL     = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd733, emissiveIntensity: 0.5, roughness: 0.3 });

    const tileMeshes    = {};
    const tileMatsOrig  = {};
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = FILES[c] + (8 - r);
        const isLight = (r + c) % 2 === 0;
        const m = isLight ? MAT_LIGHT : MAT_DARK;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE - 0.001, 0.003, TILE - 0.001), m);
        tile.position.set(BOFF + c * TILE, 0, BOFF + r * TILE);
        tile.userData = { sq };
        boardGroup.add(tile);
        tileMeshes[sq] = tile;
        tileMatsOrig[sq] = m;
      }
    }

    const v2 = pts => pts.map(([r, y]) => new THREE.Vector2(r, y));
    const GEO = {
      p:       new THREE.LatheGeometry(v2([[0,0],[0.016,0],[0.017,0.002],[0.011,0.006],[0.007,0.011],[0.007,0.018],[0.011,0.023],[0.012,0.026],[0.010,0.029],[0.003,0.032],[0,0.033]]), SEG),
      r:       new THREE.LatheGeometry(v2([[0,0],[0.017,0],[0.018,0.002],[0.013,0.006],[0.011,0.011],[0.011,0.026],[0.015,0.029],[0.018,0.032],[0.018,0.036],[0,0.036]]), SEG),
      b:       new THREE.LatheGeometry(v2([[0,0],[0.016,0],[0.017,0.002],[0.011,0.006],[0.007,0.012],[0.007,0.025],[0.009,0.029],[0.009,0.034],[0.005,0.039],[0.004,0.043],[0.001,0.046],[0,0.047]]), SEG),
      q:       new THREE.LatheGeometry(v2([[0,0],[0.017,0],[0.018,0.002],[0.012,0.006],[0.008,0.012],[0.008,0.023],[0.013,0.029],[0.015,0.033],[0.011,0.039],[0.007,0.043],[0.009,0.047],[0.010,0.050],[0.007,0.053],[0,0.055]]), SEG),
      k_body:  new THREE.LatheGeometry(v2([[0,0],[0.018,0],[0.019,0.002],[0.013,0.006],[0.009,0.012],[0.009,0.026],[0.014,0.031],[0.016,0.035],[0.012,0.040],[0.007,0.044],[0.007,0.048],[0.004,0.051],[0,0.052]]), SEG),
      n_body:  new THREE.CylinderGeometry(0.009, 0.016, 0.023, SEG),
      n_neck:  new THREE.CylinderGeometry(0.007, 0.009, 0.010, SEG),
      n_head:  new THREE.BoxGeometry(0.012, 0.013, 0.010),
      k_crossH: new THREE.BoxGeometry(0.017, 0.004, 0.004),
      k_crossV: new THREE.BoxGeometry(0.004, 0.015, 0.004),
    };

    function buildPiece(type, color) {
      const mat = color === 'w' ? MAT_W : MAT_B;
      if (type === 'n') {
        const g = new THREE.Group();
        const b = new THREE.Mesh(GEO.n_body, mat); b.position.y = 0.0115; g.add(b);
        const n = new THREE.Mesh(GEO.n_neck, mat); n.position.set(0.002, 0.030, 0); n.rotation.z = -0.35; g.add(n);
        const h = new THREE.Mesh(GEO.n_head, mat); h.position.set(0.004, 0.040, 0); h.rotation.z = -0.30; g.add(h);
        return g;
      }
      if (type === 'k') {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(GEO.k_body, mat));
        const ch = new THREE.Mesh(GEO.k_crossH, mat); ch.position.y = 0.056; g.add(ch);
        const cv = new THREE.Mesh(GEO.k_crossV, mat); cv.position.y = 0.061; g.add(cv);
        return g;
      }
      return new THREE.Mesh(GEO[type] || GEO.p, mat);
    }

    function applyMatToMesh(obj, mat) {
      if (obj.isGroup) obj.children.forEach(c => { if (c.material) c.material = mat; });
      else obj.material = mat;
    }

    const pieceMeshes = {};

    function sqToXZ(sq) {
      const c = sq.charCodeAt(0) - 97;
      const r = 8 - parseInt(sq[1]);
      return [BOFF + c * TILE, BOFF + r * TILE];
    }

    function clearPieces() {
      Object.values(pieceMeshes).forEach(m => boardGroup.remove(m));
      Object.keys(pieceMeshes).forEach(k => delete pieceMeshes[k]);
    }

    function placePieces() {
      clearPieces();
      const eng = engineRef.current;
      if (!eng) return;
      // Reset tile materials to current theme before adding pieces
      Object.entries(tileMeshes).forEach(([sq, t]) => { t.material = tileMatsOrig[sq]; });
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = eng.board()[r][c];
          if (!piece) continue;
          const sq = FILES[c] + (8 - r);
          const mesh = buildPiece(piece.type, piece.color);
          const [x, z] = sqToXZ(sq);
          mesh.position.set(x, 0.003, z);
          mesh.userData = { sq, pieceColor: piece.color };
          boardGroup.add(mesh);
          pieceMeshes[sq] = mesh;
        }
      }
      // Highlight king square red when in check
      if (eng.isCheck()) {
        const turnColor = eng.turn();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = eng.board()[r][c];
            if (piece?.type === 'k' && piece.color === turnColor) {
              const sq = FILES[c] + (8 - r);
              if (tileMeshes[sq]) tileMeshes[sq].material = MAT_CHECK;
            }
          }
        }
      }
    }

    function clearHighlights() {
      Object.entries(tileMeshes).forEach(([sq, t]) => { t.material = tileMatsOrig[sq]; });
      Object.entries(pieceMeshes).forEach(([, m]) => {
        applyMatToMesh(m, m.userData.pieceColor === 'w' ? MAT_W : MAT_B);
      });
    }

    function showHint(from, to) {
      clearHighlights();
      selectedRef.current = null;
      if (from && tileMeshes[from]) tileMeshes[from].material = MAT_HINT_FROM;
      if (to   && tileMeshes[to])   tileMeshes[to].material   = MAT_HINT_TO;
    }

    const api = { refreshPieces: placePieces, showHint };
    sceneOpsRef.current = api;
    if (boardApiRef) boardApiRef.current = api;
    placePieces();

    // Orbit drag
    let isOrbit = false, orbitX0 = 0, orbitY0 = 0, hasMoved = false;
    function orbitStart(e) {
      if (renderer.xr.isPresenting) return;
      isOrbit = true; hasMoved = false;
      orbitX0 = e.touches ? e.touches[0].clientX : e.clientX;
      orbitY0 = e.touches ? e.touches[0].clientY : e.clientY;
    }
    function orbitMove(e) {
      if (!isOrbit || renderer.xr.isPresenting) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - orbitX0, dy = cy - orbitY0;
      if (Math.abs(dx) + Math.abs(dy) > 12) hasMoved = true;
      orbitTheta -= dx * 0.009;
      orbitPhi = Math.max(0.18, Math.min(1.45, orbitPhi + dy * 0.009));
      orbitX0 = cx; orbitY0 = cy;
      updateCameraFromSphere();
    }
    function orbitEnd() { isOrbit = false; }
    mount.addEventListener('mousedown',  orbitStart);
    mount.addEventListener('mousemove',  orbitMove);
    mount.addEventListener('mouseup',    orbitEnd);
    mount.addEventListener('mouseleave', orbitEnd);
    mount.addEventListener('touchstart', orbitStart, { passive: true });
    mount.addEventListener('touchmove',  orbitMove,  { passive: true });
    mount.addEventListener('touchend',   orbitEnd);

    // Raycasting / piece selection
    const raycaster = new THREE.Raycaster();
    const mouse2 = new THREE.Vector2();

    function onPointer(e) {
      if (renderer.xr.isPresenting || hasMoved) return;
      e.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      mouse2.x = ((cx - rect.left) / rect.width)  * 2 - 1;
      mouse2.y = -((cy - rect.top)  / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse2, camera);
      const hits = raycaster.intersectObjects(
        [...Object.values(tileMeshes), ...Object.values(pieceMeshes)], true
      );
      if (!hits.length) return;

      let sq = hits[0].object.userData.sq;
      if (!sq) {
        let obj = hits[0].object.parent;
        while (obj && !sq) { sq = obj.userData?.sq; obj = obj.parent; }
      }
      if (!sq) return;

      const eng = engineRef.current;
      const prev = selectedRef.current;
      const allowedColor = selectableColorRef.current;

      if (!prev) {
        const piece = eng.get(sq);
        if (!piece) return;
        if (allowedColor ? piece.color !== allowedColor : piece.color !== eng.turn()) return;
        const legals = eng.moves({ square: sq, verbose: true }).map(m => m.to);
        clearHighlights();
        if (tileMeshes[sq]) tileMeshes[sq].material = MAT_SEL;
        const pm = pieceMeshes[sq];
        if (pm) applyMatToMesh(pm, piece.color === 'w' ? MAT_W_SEL : MAT_B_SEL);
        legals.forEach(s => { if (tileMeshes[s]) tileMeshes[s].material = MAT_LEGAL; });
        selectedRef.current = sq;
        setSelectedSq(sq);
      } else {
        if (sq === prev) { clearHighlights(); selectedRef.current = null; setSelectedSq(null); return; }
        // chess.js v1.x throws on illegal moves — wrap so reselection still works
        let mv = null;
        try { mv = new Chess(eng.fen()).move({ from: prev, to: sq, promotion: 'q' }); } catch (_) {}
        if (mv) {
          clearHighlights();
          selectedRef.current = null;
          setSelectedSq(null);
          onMoveRef.current?.(mv);
        } else {
          const piece = eng.get(sq);
          if (piece && (allowedColor ? piece.color === allowedColor : piece.color === eng.turn())) {
            const legals = eng.moves({ square: sq, verbose: true }).map(m => m.to);
            clearHighlights();
            if (tileMeshes[sq]) tileMeshes[sq].material = MAT_SEL;
            const pm2 = pieceMeshes[sq];
            if (pm2) applyMatToMesh(pm2, piece.color === 'w' ? MAT_W_SEL : MAT_B_SEL);
            legals.forEach(s => { if (tileMeshes[s]) tileMeshes[s].material = MAT_LEGAL; });
            selectedRef.current = sq;
            setSelectedSq(sq);
          } else {
            clearHighlights();
            selectedRef.current = null;
            setSelectedSq(null);
          }
        }
      }
    }

    renderer.domElement.addEventListener('click',    onPointer);
    renderer.domElement.addEventListener('touchend', onPointer, { passive: false });
    renderer.setAnimationLoop(() => { renderer.render(scene, camera); });

    function handleResize() {
      const m = mountRef.current;
      if (!m || !renderer || !camera) return;
      const newW = m.clientWidth || 380;
      const isMob = window.innerWidth < 768;
      const newH = isMob ? Math.min(newW, 340) : Math.min(newW, 420);
      renderer.setSize(newW, newH);
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', handleResize);

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click',    onPointer);
      renderer.domElement.removeEventListener('touchend', onPointer);
      mount.removeEventListener('mousedown',  orbitStart);
      mount.removeEventListener('mousemove',  orbitMove);
      mount.removeEventListener('mouseup',    orbitEnd);
      mount.removeEventListener('mouseleave', orbitEnd);
      mount.removeEventListener('touchstart', orbitStart);
      mount.removeEventListener('touchmove',  orbitMove);
      mount.removeEventListener('touchend',   orbitEnd);
      Object.values(GEO).forEach(g => g?.dispose?.());
      Object.values(tileMeshes).forEach(t => t.geometry?.dispose?.());
      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneOpsRef.current = null;
      if (boardApiRef) boardApiRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AR camera helpers ─────────────────────────────────────────
  async function startAR() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setArStatus('Camera not available — check browser permissions');
      return;
    }
    try {
      setArStatus('Requesting camera…');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const vid = videoRef.current;
      if (vid) { vid.srcObject = stream; await vid.play().catch(() => {}); }
      setArActive(true);
      setArStatus('AR camera active');
    } catch (err) {
      setArStatus(`Camera error: ${err.message}`);
    }
  }

  function stopAR() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setArActive(false);
    setArStatus('');
    onExitAR?.();
  }

  // ── Non-AR 3D mode ────────────────────────────────────────────
  if (!enableAR) {
    return (
      <div className="chess3d-wrap">
        {selectedSq && <span className="ar-sel-badge chess3d-sel">Selected: {selectedSq.toUpperCase()}</span>}
        <div ref={mountRef} className="ar-mount" />
      </div>
    );
  }

  // ── AR mode ───────────────────────────────────────────────────
  return (
    <div className={`ar-panel${arActive ? ' ar-panel--active' : ''}`}>
      {/* Info bar — always visible */}
      <div className="ar-info-bar">
        <span className={`ar-badge ${arActive ? 'supported' : 'fallback'}`}>
          {arActive ? '● Live AR' : '◎ 3D Chess'}
        </span>
        <span className="ar-status-text">{arStatus || 'Ready'}</span>
        {selectedSq && <span className="ar-sel-badge">Selected: {selectedSq.toUpperCase()}</span>}
      </div>

      {/* Camera feed behind board */}
      <video ref={videoRef} autoPlay playsInline muted
        className={`ar-video${arActive ? ' ar-video--active' : ''}`} />

      {/* Three.js canvas */}
      <div ref={mountRef} className="ar-mount" />

      {/* Pre-start instructions */}
      {!arActive && (
        <div className="ar-launch glass-card">
          <p className="ar-launch-step">① Tap <strong>Start AR</strong> and allow camera</p>
          <p className="ar-launch-step">② Board overlays your camera — drag to orbit</p>
          <p className="ar-launch-step">③ Tap pieces to select, then tap destination to move</p>
          <button className="ar-enter-btn" onClick={startAR}>▶ Start AR</button>
        </div>
      )}

      {/* AR active: stop button + floating game controls */}
      {arActive && (
        <>
          <button className="ar-stop-btn" onClick={stopAR}>✕ Stop AR</button>

          {/* Floating game controls overlay — visible on top of AR */}
          <div className="ar-hud">
            <span className={`ar-hud-status${isGameOver ? ' gameover' : ''}`}>{statusText}</span>
            <div className="ar-hud-btns">
              {!isGameOver && onRequestHint && (
                <button className="ar-hud-btn" onClick={onRequestHint} disabled={hintLoading}>
                  {hintLoading ? '…' : '💡'}
                </button>
              )}
              {onToggleHistory && (
                <button className="ar-hud-btn" onClick={onToggleHistory}>📋</button>
              )}
              {onReset && (
                <button className="ar-hud-btn reset" onClick={onReset}>↺</button>
              )}
            </div>
          </div>

          {/* Gameover overlay in AR mode */}
          {isGameOver && onReset && (
            <div className="ar-gameover">
              <div className="ar-gameover-card">
                <p className="gameover-title">{statusText}</p>
                <button className="primary-btn" onClick={onReset}>Play Again</button>
              </div>
            </div>
          )}

          {/* Move history overlay in AR mode */}
          {showHistory && moveHistory.length > 0 && (
            <div className="ar-history-overlay glass-card">
              <div className="history-header">
                <span>Moves</span>
                <span className="muted">{moveHistory.length}</span>
              </div>
              <div className="history-grid">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="history-pair">
                    <span className="move-num">{i + 1}.</span>
                    <span className="move-san white-move">{moveHistory[i * 2]}</span>
                    <span className="move-san black-move">{moveHistory[i * 2 + 1] || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
