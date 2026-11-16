/* MechBridge clay scroll background — standalone build (site copy).
   Site changes vs background-design/: props paintTarget, layout (desktop x/y override),
   mobileLayout (x + ypx per piece under 768px), smaller pieces and DPR cap on phones.
   Source of truth for the logic is source/Main.dc.html (the design canvas).
   Usage: see README.md. Requires vendor/three.min.js (three.js r159) loaded first. */
(function () {
  // Minimal stand-in for the canvas runtime's base class.
  class DCLogic { constructor() { this.props = {}; this.state = {}; } setState() {} forceUpdate() {} }

class Component extends DCLogic {
  componentDidMount() {
    this._alive = true;
    this._cur = null;
    this._t0 = null;
    this._gl = null;
    this._dead = false;
    this._lastKey = '';
    this._colKey = '';
    this._loop = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  componentDidUpdate() {
    this._t0 = null;
    this._cur = null;
    this._lastKey = '';
  }

  componentWillUnmount() {
    this._alive = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._gl) {
      try { this._gl.renderer.dispose(); } catch (e) {}
    }
  }

  // ---------- colour ----------

  // One ground and one cord colour per section, all from the brand scales.
  _stops() {
    if (this._st) return this._st;
    var navy = [26, 40, 65], cream = [240, 225, 206], red = [177, 23, 34];
    this._st = {
      ground: [navy, [31, 47, 76], cream, [19, 30, 50], [13, 21, 35], [245, 235, 221], [8, 13, 23], [31, 47, 76], cream, navy],
      cord: [red, cream, red, cream, cream, navy, [226, 113, 120], cream, navy, cream],
      // Cream to navy routes through red so it never turns grey.
      via: {}
    };
    return this._st;
  }

  // Mechbridge site: sections may differ in height. props.bands holds 11 boundaries (fractions of the root).
  _band(i) {
    var b = this.props.bands;
    return b && b.length === 11 ? b[Math.max(0, Math.min(10, i))] : Math.max(0, Math.min(10, i)) / 10;
  }
  // Page y (px from the root top) to section units, 0 to 10.
  _pos(y, H) {
    var f = y / H;
    if (f <= 0) return 0;
    for (var i = 0; i < 10; i++) {
      var a = this._band(i), b = this._band(i + 1);
      if (f < b) return i + (b > a ? (f - a) / (b - a) : 0);
    }
    return 10;
  }

  _lerp3(a, b, u) {
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }

  // pos is the viewport centre measured in sections (0 to 10).
  _colours(pos) {
    var S = this._stops();
    var half = 0.15;
    var k = 0;
    while (k < 9 && pos > k + 1 + half) k++;
    var edge = k + 1;
    if (k >= 9 || pos <= edge - half) return [S.ground[k], S.cord[k]];
    var u = (pos - (edge - half)) / (2 * half);
    u = u * u * (3 - 2 * u);
    var cord = this._lerp3(S.cord[k], S.cord[k + 1], u);
    if (S.via[k]) {
      var red = [177, 23, 34];
      if (u < 0.5) return [this._lerp3(S.ground[k], red, u * 2), cord];
      return [this._lerp3(red, S.ground[k + 1], u * 2 - 1), cord];
    }
    return [this._lerp3(S.ground[k], S.ground[k + 1], u), cord];
  }

  _paint(root, g) {
    var key = Math.round(g[0]) + ',' + Math.round(g[1]) + ',' + Math.round(g[2]);
    if (key === this._colKey) return;
    this._colKey = key;
    (this.props.paintTarget || root).style.setProperty('--ground', 'rgb(' + key + ')');
  }

  // ---------- clay kit ----------

  _bumpTex() {
    var T = window.THREE;
    var n = 64, raw = [], i, x, y;
    for (i = 0; i < n * n; i++) raw.push(Math.random());
    var data = new Uint8Array(n * n * 4);
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        var s = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            s += raw[((y + dy + n) % n) * n + ((x + dx + n) % n)];
          }
        }
        var v = Math.round((s / 9) * 255);
        var o = (y * n + x) * 4;
        data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
      }
    }
    var tex = new T.DataTexture(data, n, n, T.RGBAFormat);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.magFilter = T.LinearFilter;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  _mat(col, glow) {
    var T = window.THREE;
    var key = col + '|' + (glow || 0);
    if (!this._mats) this._mats = {};
    if (this._mats[key]) return this._mats[key];
    var m = new T.MeshStandardMaterial({
      color: col, roughness: 0.92, metalness: 0,
      bumpMap: this._bump, bumpScale: 0.35
    });
    if (glow) { m.emissive = new T.Color(col); m.emissiveIntensity = glow; }
    this._mats[key] = m;
    return m;
  }

  // Push every vertex a little so nothing looks machine made.
  _wob(g, amp) {
    var a = amp == null ? 0.012 : amp;
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i,
        x + a * Math.sin(3.1 * y + 1.7 * z + 0.4),
        y + a * Math.sin(2.7 * z + 3.3 * x + 1.9),
        z + a * Math.sin(3.7 * x + 2.3 * y + 0.9));
    }
    p.needsUpdate = true;
    return g;
  }

  _rbox(w, h, d, r) {
    var T = window.THREE;
    r = Math.min(r == null ? 0.04 : r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    var iw = w - 2 * r, ih = h - 2 * r;
    var c = Math.min(r * 0.6, iw / 2, ih / 2);
    var x = -iw / 2, y = -ih / 2;
    var s = new T.Shape();
    s.moveTo(x + c, y);
    s.lineTo(x + iw - c, y);
    s.quadraticCurveTo(x + iw, y, x + iw, y + c);
    s.lineTo(x + iw, y + ih - c);
    s.quadraticCurveTo(x + iw, y + ih, x + iw - c, y + ih);
    s.lineTo(x + c, y + ih);
    s.quadraticCurveTo(x, y + ih, x, y + ih - c);
    s.lineTo(x, y + c);
    s.quadraticCurveTo(x, y, x + c, y);
    var g = new T.ExtrudeGeometry(s, {
      depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r,
      bevelSegments: 3, curveSegments: 4, steps: 1
    });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return this._wob(g, Math.min(0.012, Math.min(w, h, d) * 0.12));
  }

  _kit(piece) {
    var self = this, T = window.THREE;
    var kit = {
      box: function (w, h, d, r) { return self._rbox(w, h, d, r); },
      sph: function (r, seg) { return self._wob(new T.SphereGeometry(r, seg || 24, seg ? Math.round(seg * 0.7) : 16), Math.min(0.014, r * 0.1)); },
      ext: function (pts, depth, bev) {
        var s = new T.Shape();
        s.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
        s.closePath();
        var b = bev == null ? 0.015 : bev;
        var g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4, steps: 1 });
        g.translate(0, 0, -depth / 2);
        return self._wob(g, 0.006);
      },
      cyl: function (rt, rb, h, seg) { return self._wob(new T.CylinderGeometry(rt, rb, h, seg || 22, 1), Math.min(0.012, Math.max(rt, rb) * 0.12)); },
      cap: function (r, len) { return self._wob(new T.CapsuleGeometry(r, len, 6, 14), Math.min(0.012, r * 0.12)); },
      tor: function (R, r, arc) { return self._wob(new T.TorusGeometry(R, r, 10, 30, arc == null ? Math.PI * 2 : arc), r * 0.2); },
      curve: function (pts, closed) {
        var v = [];
        for (var i = 0; i < pts.length; i++) v.push(new T.Vector3(pts[i][0], pts[i][1], pts[i][2]));
        return new T.CatmullRomCurve3(v, !!closed);
      },
      tube: function (curve, r) { return self._wob(new T.TubeGeometry(curve, 48, r, 8, false), r * 0.2); },
      G: function (x, y, z, parent) {
        var g = new T.Group();
        g.position.set(x || 0, y || 0, z || 0);
        (parent || piece.inner).add(g);
        return g;
      },
      M: function (geo, col, x, y, z, parent, glow) {
        var m = new T.Mesh(geo, self._mat(col, glow));
        m.position.set(x || 0, y || 0, z || 0);
        m.castShadow = true;
        m.receiveShadow = true;
        (parent || piece.inner).add(m);
        piece.parts.push(m);
        return m;
      },
      puck: function (col) {
        var m = kit.M(kit.cyl(1.14, 1.1, 0.16, 40), col, 0, -0.98, 0);
        m.castShadow = false;
        return m;
      }
    };
    return kit;
  }

  // ---------- the pieces ----------

  _house(k) {
    var G = -0.9;
    var CREAM = 0xF0E1CE, RED = 0xB11722, N3 = 0x6B7A97, PW = 0xFBF8F3, R3 = 0xE27178;
    k.puck(0x2A3A59);
    k.M(k.box(1.25, 0.56, 0.82, 0.06), CREAM, 0.14, G + 0.28, 0);
    k.M(k.box(1.0, 0.5, 0.76, 0.06), RED, -0.22, G + 0.81, 0.02);
    var roof = k.M(k.box(1.16, 0.08, 0.92, 0.035), N3, -0.22, G + 1.1, 0.02);
    roof.rotation.z = 0.05;
    k.M(k.box(0.15, 0.42, 0.15, 0.03), CREAM, 0.58, G + 0.77, -0.2);
    k.M(k.box(0.56, 0.24, 0.05, 0.02), PW, -0.3, G + 0.83, 0.4);
    k.M(k.box(0.2, 0.2, 0.05, 0.02), PW, 0.12, G + 0.85, 0.4);
    k.M(k.box(0.5, 0.38, 0.05, 0.02), N3, -0.12, G + 0.25, 0.42);
    k.M(k.box(0.17, 0.36, 0.05, 0.02), RED, 0.42, G + 0.2, 0.42);
    k.M(k.box(0.5, 0.09, 0.03, 0.012), N3, 0.52, G + 0.62, 0.38);
    k.M(k.box(0.03, 0.09, 0.78, 0.012), N3, 0.75, G + 0.62, 0);
    k.M(k.sph(0.13), R3, -0.72, G + 0.1, 0.5);
    k.M(k.sph(0.1), N3, -0.52, G + 0.08, 0.6);
    var s1 = k.M(k.sph(0.1), 0x6B7A97, 0.25, G + 0.01, 0.62); s1.scale.set(1, 0.25, 1);
    var s2 = k.M(k.sph(0.1), 0x6B7A97, 0.42, G + 0.01, 0.84); s2.scale.set(1, 0.25, 1);
    var tree = k.G(0.94, G, 0.26);
    k.M(k.cyl(0.035, 0.05, 0.34), N3, 0, 0.17, 0, tree);
    k.M(k.sph(0.25), R3, 0, 0.52, 0, tree);
    k.M(k.sph(0.16), RED, 0.12, 0.72, 0.04, tree);
    var puffs = [];
    for (var i = 0; i < 3; i++) {
      var pg = k.G(0.58, G + 1.0, -0.2);
      k.M(k.sph(0.09), PW, 0, 0, 0, pg);
      puffs.push(pg);
    }
    return function (t) {
      tree.rotation.z = 0.07 * Math.sin(t * 1.6);
      for (var i = 0; i < 3; i++) {
        var ph = (t * 0.3 + i / 3) % 1;
        puffs[i].position.set(0.58 + 0.12 * Math.sin(ph * 5 + i), G + 1.02 + ph * 0.6, -0.2);
        puffs[i].scale.setScalar(0.25 + 1.1 * Math.sin(ph * Math.PI));
      }
    };
  }

  _C() {
    return {
      cream: 0xF0E1CE, red: 0xB11722, navy: 0x1A2841, n3: 0x6B7A97, n4: 0x3F5072, n5: 0x2A3A59,
      r3: 0xE27178, r6: 0x96131D, r8: 0x5E0C12, r9: 0x42080D, c5: 0xD4B590, c6: 0xBC9A72, pw: 0xFBF8F3
    };
  }

  _design(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.r6);
    k.M(k.box(1.7, 0.08, 1.2, 0.035), c.r8, 0, G + 0.04, 0);
    var sheet = k.G(-0.04, G + 0.08, 0);
    sheet.rotation.y = 0.06;
    k.M(k.box(1.42, 0.03, 0.96, 0.012), c.pw, 0, 0.015, 0, sheet);
    // The house elevation, as raised strokes on the sheet: width, depth, x, z.
    var L = [[0.9, 0.03, -0.06, 0.22], [0.03, 0.26, -0.36, 0.09], [0.03, 0.26, 0.34, 0.09], [0.73, 0.03, -0.01, -0.04],
      [0.03, 0.2, -0.46, -0.14], [0.03, 0.2, 0.09, -0.14], [0.62, 0.035, -0.18, -0.25], [0.2, 0.1, -0.16, 0.12], [0.08, 0.14, 0.19, 0.15]];
    for (i = 0; i < L.length; i++) k.M(k.box(L[i][0], 0.024, L[i][1], 0.01), c.red, L[i][2], 0.042, L[i][3], sheet);
    k.M(k.box(0.9, 0.03, 0.1, 0.012), c.cream, -0.1, G + 0.1, 0.53);
    k.M(k.box(0.2, 0.09, 0.12, 0.03), c.r3, -0.64, G + 0.125, -0.44);
    k.M(k.cyl(0.15, 0.12, 0.24), c.pw, 0.66, G + 0.2, -0.4);
    k.M(k.cyl(0.125, 0.125, 0.02), c.r9, 0.66, G + 0.318, -0.4);
    k.M(k.tor(0.07, 0.02), c.pw, 0.82, G + 0.2, -0.4);
    var steam = [];
    for (i = 0; i < 2; i++) {
      var sg = k.G(0.66, G + 0.4, -0.4);
      k.M(k.sph(0.06), c.cream, 0, 0, 0, sg);
      steam.push(sg);
    }
    var pen = k.G(0.4, G + 0.125, 0.22);
    pen.rotation.set(0.2, 0, -0.85);
    k.M(k.cyl(0.05, 0.006, 0.13, 6), c.c5, 0, 0.065, 0, pen);
    k.M(k.cyl(0.05, 0.05, 0.66, 6), c.n5, 0, 0.46, 0, pen);
    k.M(k.cyl(0.054, 0.054, 0.05, 12), c.cream, 0, 0.815, 0, pen);
    k.M(k.cyl(0.05, 0.05, 0.08, 12), c.r3, 0, 0.88, 0, pen);
    return function (t) {
      var s = Math.sin(t * 3);
      pen.position.x = 0.4 - 0.26 * (0.5 + 0.5 * s);
      pen.position.z = 0.22 + 0.02 * Math.sin(t * 9);
      pen.rotation.z = -0.85 + 0.08 * s;
      for (var i = 0; i < 2; i++) {
        var ph = (t * 0.4 + i / 2) % 1;
        steam[i].position.set(0.66 + 0.05 * Math.sin(ph * 6 + i), G + 0.4 + ph * 0.4, -0.4);
        steam[i].scale.setScalar(0.2 + Math.sin(ph * Math.PI));
      }
    };
  }

  _foundation(k) {
    var G = -0.9, c = this._C(), i, j;
    k.puck(c.c6);
    k.M(k.box(1.15, 0.1, 0.75, 0.03), c.pw, -0.2, G + 0.05, -0.15);
    for (i = 0; i < 3; i++) {
      for (j = 0; j < 2; j++) k.M(k.cyl(0.018, 0.018, 0.3, 8), c.navy, -0.65 + i * 0.45, G + 0.25, -0.42 + j * 0.54);
    }
    var st = [[-0.86, 0.32], [0.46, 0.32], [0.46, -0.62], [-0.86, -0.62]];
    for (i = 0; i < 4; i++) k.M(k.cyl(0.022, 0.022, 0.28, 8), c.red, st[i][0], G + 0.14, st[i][1]);
    k.M(k.box(1.32, 0.014, 0.014, 0.005), c.red, -0.2, G + 0.23, 0.32);
    k.M(k.box(1.32, 0.014, 0.014, 0.005), c.red, -0.2, G + 0.23, -0.62);
    k.M(k.box(0.014, 0.014, 0.94, 0.005), c.red, -0.86, G + 0.23, -0.15);
    k.M(k.box(0.014, 0.014, 0.94, 0.005), c.red, 0.46, G + 0.23, -0.15);
    var d1 = k.M(k.sph(0.26), c.c5, 0.78, G + 0.1, -0.45); d1.scale.set(1.2, 0.7, 1);
    var d2 = k.M(k.sph(0.15), c.c5, 0.93, G + 0.06, -0.14); d2.scale.set(1, 0.7, 1);
    k.M(k.box(0.2, 0.03, 0.2, 0.012), c.navy, -0.62, G + 0.015, 0.66);
    k.M(k.cyl(0.012, 0.08, 0.2), c.red, -0.62, G + 0.13, 0.66);
    var dig = k.G(0.42, G, 0.52);
    k.M(k.box(0.5, 0.1, 0.34, 0.045), c.navy, 0, 0.05, 0, dig);
    k.M(k.box(0.4, 0.2, 0.3, 0.05), c.red, 0.02, 0.2, 0, dig);
    k.M(k.box(0.18, 0.22, 0.22, 0.04), c.pw, 0.1, 0.4, 0.02, dig);
    k.M(k.box(0.03, 0.12, 0.16, 0.012), c.n3, 0.0, 0.42, 0.02, dig);
    var boom = k.G(-0.14, 0.3, 0, dig);
    k.M(k.box(0.07, 0.5, 0.07, 0.03), c.red, 0, 0.25, 0, boom);
    var stick = k.G(0, 0.5, 0, boom);
    k.M(k.box(0.06, 0.4, 0.06, 0.025), c.red, 0, 0.2, 0, stick);
    k.M(k.box(0.14, 0.12, 0.16, 0.04), c.navy, 0, 0.42, 0, stick);
    return function (t) {
      dig.rotation.y = 0.5 + 0.3 * Math.sin(t * 0.7);
      boom.rotation.z = 0.7 + 0.3 * Math.sin(t * 1.4);
      stick.rotation.z = 1.5 + 0.5 * Math.sin(t * 1.4 + 1);
    };
  }

  _construction(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.n5);
    k.M(k.box(1.25, 0.07, 0.85, 0.03), c.n3, 0.15, G + 0.035, 0.05);
    var xs = [-0.4, -0.12, 0.16, 0.44, 0.7];
    for (i = 0; i < 5; i++) k.M(k.box(0.05, 0.6, 0.05, 0.02), c.cream, xs[i], G + 0.37, -0.3);
    for (i = 0; i < 5; i++) k.M(k.box(0.05, 0.6, 0.05, 0.02), c.cream, xs[i], G + 0.37, 0.4);
    k.M(k.box(1.15, 0.05, 0.05, 0.02), c.cream, 0.15, G + 0.69, -0.3);
    k.M(k.box(1.15, 0.05, 0.05, 0.02), c.cream, 0.15, G + 0.69, 0.4);
    k.M(k.box(0.05, 0.05, 0.7, 0.02), c.cream, -0.4, G + 0.69, 0.05);
    k.M(k.box(0.05, 0.05, 0.7, 0.02), c.cream, 0.7, G + 0.69, 0.05);
    for (i = 0; i < 3; i++) k.M(k.box(0.045, 0.045, 0.82, 0.018), c.cream, -0.14 + i * 0.3, G + 0.74, 0.05);
    k.M(k.box(0.46, 0.035, 0.84, 0.014), c.c5, -0.2, G + 0.785, 0.05);
    for (i = 0; i < 3; i++) k.M(k.box(0.14, 0.07, 0.08, 0.02), c.red, -0.78 + (i % 2) * 0.16 + (i === 2 ? 0.08 : 0), G + 0.035 + (i === 2 ? 0.07 : 0), 0.42);
    k.M(k.cap(0.06, 0.12), c.cream, -0.5, G + 0.12, 0.72);
    k.M(k.sph(0.06), c.r3, -0.5, G + 0.3, 0.72);
    var hat = k.M(k.sph(0.07), c.red, -0.5, G + 0.33, 0.72); hat.scale.set(1, 0.6, 1);
    k.M(k.box(0.26, 0.08, 0.26, 0.03), c.n3, -0.8, G + 0.04, -0.45);
    k.M(k.box(0.08, 1.75, 0.08, 0.02), c.red, -0.8, G + 0.95, -0.45);
    var slew = k.G(-0.8, G + 1.83, -0.45);
    k.M(k.box(1.35, 0.06, 0.06, 0.02), c.red, 0.5, 0, 0, slew);
    k.M(k.box(0.3, 0.1, 0.12, 0.03), c.cream, -0.22, -0.02, 0, slew);
    k.M(k.box(0.14, 0.14, 0.12, 0.03), c.cream, 0.06, -0.1, 0.08, slew);
    k.M(k.box(0.05, 0.22, 0.05, 0.02), c.red, 0, 0.12, 0, slew);
    var hang = k.G(0.95, 0, 0, slew);
    k.M(k.cyl(0.01, 0.01, 0.6, 6), c.cream, 0, -0.3, 0, hang);
    k.M(k.box(0.06, 0.06, 0.06, 0.02), c.n3, 0, -0.62, 0, hang);
    k.M(k.box(0.42, 0.07, 0.09, 0.025), c.r3, 0, -0.72, 0, hang);
    return function (t) {
      slew.rotation.y = 0.35 + 0.45 * Math.sin(t * 0.5);
      hang.rotation.z = 0.12 * Math.sin(t * 1.7);
    };
  }

  _plumbing(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.r8);
    k.M(k.cyl(0.3, 0.3, 0.7, 28), c.cream, -0.6, G + 0.35, -0.1);
    var dome = k.M(k.sph(0.3), c.cream, -0.6, G + 0.7, -0.1); dome.scale.set(1, 0.45, 1);
    var band = k.M(k.tor(0.305, 0.022), c.r3, -0.6, G + 0.3, -0.1); band.rotation.x = Math.PI / 2;
    var dial = k.M(k.cyl(0.08, 0.08, 0.03), c.pw, -0.6, G + 0.5, 0.2); dial.rotation.x = Math.PI / 2;
    var needle = k.G(-0.6, G + 0.5, 0.225);
    k.M(k.box(0.018, 0.07, 0.014, 0.005), c.red, 0, 0.03, 0, needle);
    var path = k.curve([[-0.6, -0.08, -0.1], [-0.6, 0.18, -0.1], [-0.5, 0.27, -0.1], [0.0, 0.27, -0.1], [0.45, 0.27, -0.1],
      [0.55, 0.18, -0.1], [0.55, -0.1, -0.1], [0.55, -0.24, -0.02], [0.55, -0.27, 0.2], [0.55, -0.37, 0.3]]);
    k.M(k.tube(path, 0.05), c.pw);
    k.M(k.sph(0.075), c.cream, -0.57, 0.24, -0.1);
    k.M(k.sph(0.075), c.cream, 0.52, 0.24, -0.1);
    k.M(k.sph(0.07), c.cream, 0.55, -0.26, 0.02);
    k.M(k.cyl(0.02, 0.02, 0.16, 8), c.cream, 0, 0.36, -0.1);
    var wheel = k.G(0, 0.45, -0.1);
    var ring = k.M(k.tor(0.1, 0.025), c.r3, 0, 0, 0, wheel); ring.rotation.x = Math.PI / 2;
    k.M(k.box(0.2, 0.022, 0.022, 0.008), c.r3, 0, 0, 0, wheel);
    k.M(k.box(0.022, 0.022, 0.2, 0.008), c.r3, 0, 0, 0, wheel);
    k.M(k.cyl(0.26, 0.2, 0.22, 28), c.cream, 0.55, G + 0.11, 0.3);
    k.M(k.cyl(0.22, 0.22, 0.02, 28), c.n3, 0.55, G + 0.225, 0.3);
    var wr = k.G(-0.15, G + 0.03, 0.68);
    wr.rotation.y = 0.4;
    k.M(k.box(0.4, 0.04, 0.07, 0.015), c.n3, 0, 0, 0, wr);
    var jaw = k.M(k.tor(0.06, 0.022, 4.4), c.n3, 0.24, 0, 0, wr); jaw.rotation.x = Math.PI / 2;
    var drops = [], bulges = [];
    for (i = 0; i < 3; i++) {
      var dg = k.G(0.55, -0.4, 0.3);
      k.M(k.sph(0.04), c.n3, 0, 0, 0, dg);
      drops.push(dg);
    }
    for (i = 0; i < 4; i++) {
      var bg = k.G(0, 0, 0);
      k.M(k.sph(0.068), c.pw, 0, 0, 0, bg);
      bulges.push(bg);
    }
    return function (t) {
      wheel.rotation.y = t * 1.6;
      needle.rotation.z = 0.9 * Math.sin(t * 1.1);
      for (var i = 0; i < 3; i++) {
        var ph = (t * 0.9 + i / 3) % 1;
        drops[i].position.y = -0.42 - ph * ph * 0.24;
        drops[i].scale.set(1, 1 + ph * 0.6, 1);
      }
      for (i = 0; i < 4; i++) {
        var u = (t * 0.22 + i / 4) % 1;
        bulges[i].position.copy(path.getPointAt(u));
        bulges[i].scale.setScalar(0.6 + 0.5 * Math.sin(u * Math.PI));
      }
    };
  }

  _airflow(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.c5);
    k.M(k.box(1.5, 0.06, 1.05, 0.03), c.n3, 0, G + 0.03, 0);
    k.M(k.box(1.5, 1.0, 0.07, 0.03), c.n5, 0, G + 0.53, -0.49);
    k.M(k.box(0.07, 1.0, 1.05, 0.03), c.n5, -0.72, G + 0.53, 0);
    k.M(k.box(0.42, 0.36, 0.03, 0.012), c.pw, 0.3, G + 0.56, -0.45);
    k.M(k.box(0.02, 0.36, 0.035, 0.008), c.n5, 0.3, G + 0.56, -0.44);
    k.M(k.box(1.2, 0.15, 0.15, 0.04), c.cream, 0.05, G + 0.92, -0.36);
    k.M(k.box(0.16, 0.03, 0.1, 0.012), c.red, -0.3, G + 0.835, -0.36);
    k.M(k.box(0.16, 0.03, 0.1, 0.012), c.red, 0.35, G + 0.835, -0.36);
    k.M(k.box(0.09, 0.22, 0.5, 0.04), c.cream, -0.65, G + 0.72, 0.05);
    k.M(k.box(0.03, 0.03, 0.42, 0.012), c.red, -0.6, G + 0.63, 0.05);
    k.M(k.box(0.5, 0.14, 0.26, 0.05), c.red, -0.2, G + 0.13, -0.2);
    k.M(k.box(0.5, 0.3, 0.09, 0.04), c.red, -0.2, G + 0.25, -0.34);
    k.M(k.box(0.08, 0.2, 0.26, 0.035), c.r3, -0.46, G + 0.18, -0.2);
    k.M(k.box(0.08, 0.2, 0.26, 0.035), c.r3, 0.06, G + 0.18, -0.2);
    var rug = k.M(k.cyl(0.3, 0.3, 0.016, 28), c.cream, -0.15, G + 0.068, 0.24); rug.scale.set(1.2, 1, 0.75);
    k.M(k.cyl(0.07, 0.055, 0.12), c.cream, 0.62, G + 0.12, -0.32);
    k.M(k.sph(0.12), c.n3, 0.62, G + 0.27, -0.32);
    k.M(k.cyl(0.12, 0.14, 0.04), c.red, 0.45, G + 0.08, 0.3);
    k.M(k.cyl(0.02, 0.02, 0.42, 8), c.cream, 0.45, G + 0.3, 0.3);
    var head = k.G(0.45, G + 0.54, 0.3);
    head.rotation.y = -0.5;
    k.M(k.tor(0.17, 0.02), c.red, 0, 0, 0.02, head);
    k.M(k.sph(0.045), c.red, 0, 0, 0.02, head);
    var blades = k.G(0, 0, 0.02, head);
    for (i = 0; i < 3; i++) {
      var a = i * Math.PI * 2 / 3;
      var bl = k.M(k.sph(0.07), c.cream, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0, blades);
      bl.scale.set(1, 0.4, 0.2);
      bl.rotation.z = a;
    }
    var loop = k.curve([[-0.58, -0.2, 0.05], [-0.3, -0.35, 0.25], [0.1, -0.5, 0.35], [0.4, -0.3, 0.1], [0.5, -0.1, -0.15],
      [0.2, 0.0, -0.22], [-0.2, -0.02, -0.2], [-0.45, -0.1, -0.1]], true);
    var puffs = [];
    for (i = 0; i < 7; i++) {
      var pg = k.G(0, 0, 0);
      k.M(k.sph(0.05), c.pw, 0, 0, 0, pg);
      puffs.push(pg);
    }
    return function (t) {
      blades.rotation.z = t * 9;
      head.rotation.y = -0.5 + 0.4 * Math.sin(t * 0.8);
      for (var i = 0; i < 7; i++) {
        var u = (t * 0.12 + i / 7) % 1;
        puffs[i].position.copy(loop.getPointAt(u));
        puffs[i].scale.setScalar(0.7 + 0.5 * Math.sin((u * 4 + i) * Math.PI));
      }
    };
  }

  _electrical(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.n5);
    k.M(k.box(1.6, 0.06, 0.8, 0.03), c.n3, 0, G + 0.03, 0);
    k.M(k.box(1.6, 1.15, 0.08, 0.03), c.n4, 0, G + 0.6, -0.4);
    k.M(k.box(0.36, 0.5, 0.1, 0.04), c.cream, -0.5, G + 0.62, -0.32);
    for (i = 0; i < 4; i++) k.M(k.box(0.05, 0.09, 0.04, 0.015), c.red, -0.59 + i * 0.06, G + 0.69, -0.26);
    k.M(k.box(0.24, 0.04, 0.03, 0.012), c.r3, -0.5, G + 0.52, -0.265);
    var dial = k.M(k.cyl(0.12, 0.12, 0.05), c.cream, -0.5, G + 0.2, -0.33); dial.rotation.x = Math.PI / 2;
    var needle = k.G(-0.5, G + 0.2, -0.295);
    k.M(k.box(0.02, 0.09, 0.014, 0.005), c.red, 0, 0.04, 0, needle);
    var A = k.curve([[-0.5, -0.03, -0.32], [-0.5, 0.15, -0.3], [-0.3, 0.2, -0.28], [0.05, 0.2, -0.24], [0.1, 0.1, -0.22], [0.1, 0.0, -0.22]]);
    var B = k.curve([[0.05, 0.2, -0.24], [0.4, 0.22, -0.24], [0.6, 0.18, -0.22], [0.62, 0.05, -0.2], [0.62, -0.08, -0.2]]);
    var C = k.curve([[-0.5, -0.53, -0.3], [-0.5, -0.75, -0.26], [-0.3, -0.82, -0.18], [0.2, -0.82, -0.1], [0.55, -0.82, -0.14], [0.62, -0.78, -0.26]]);
    k.M(k.tube(A, 0.022), c.red);
    k.M(k.tube(B, 0.022), c.red);
    k.M(k.tube(C, 0.022), c.red);
    k.M(k.cyl(0.045, 0.045, 0.07, 12), c.cream, 0.1, -0.03, -0.22);
    k.M(k.sph(0.11), c.cream, 0.1, -0.16, -0.22, null, 0.9);
    k.M(k.cyl(0.045, 0.045, 0.07, 12), c.cream, 0.62, -0.11, -0.2);
    k.M(k.sph(0.11), c.cream, 0.62, -0.24, -0.2, null, 0.9);
    k.M(k.box(0.2, 0.2, 0.08, 0.03), c.cream, 0.62, G + 0.17, -0.31);
    k.M(k.box(0.025, 0.07, 0.03, 0.01), c.navy, 0.58, G + 0.17, -0.27);
    k.M(k.box(0.025, 0.07, 0.03, 0.01), c.navy, 0.66, G + 0.17, -0.27);
    var bolt = k.G(-0.02, G + 0.42, 0.26);
    k.M(k.ext([[0.06, 0.3], [-0.12, 0.02], [-0.01, 0.02], [-0.07, -0.3], [0.13, 0.06], [0.02, 0.06]], 0.07, 0.02), c.r3, 0, 0, 0, bolt, 0.5);
    k.M(k.box(0.12, 0.08, 0.1, 0.03), c.cream, 0.3, G + 0.1, 0.28);
    k.M(k.cyl(0.012, 0.012, 0.07, 6), c.n3, 0.27, G + 0.17, 0.28);
    k.M(k.cyl(0.012, 0.012, 0.07, 6), c.n3, 0.33, G + 0.17, 0.28);
    var beads = [], wires = [A, A, B, B, C, C];
    for (i = 0; i < 6; i++) {
      var bg = k.G(0, 0, 0);
      k.M(k.sph(0.036), c.pw, 0, 0, 0, bg, 1.2);
      beads.push(bg);
    }
    var glow = this._mat(c.cream, 0.9);
    return function (t) {
      needle.rotation.z = 1.1 * Math.sin(t * 1.3);
      bolt.position.y = G + 0.42 + 0.05 * Math.sin(t * 2.2);
      bolt.rotation.y = 0.5 * Math.sin(t * 0.9);
      glow.emissiveIntensity = 0.65 + 0.35 * Math.sin(t * 3.1);
      for (var i = 0; i < 6; i++) {
        var u = (t * 0.45 + (i % 2) * 0.5) % 1;
        beads[i].position.copy(wires[i].getPointAt(u));
      }
    };
  }

  _solar(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.r6);
    k.M(k.box(0.95, 0.5, 0.72, 0.05), c.cream, -0.1, G + 0.25, -0.05);
    k.M(k.ext([[-0.56, 0], [0.56, 0], [0, 0.42]], 0.78, 0.025), c.r8, -0.1, G + 0.5, -0.05);
    k.M(k.box(0.16, 0.3, 0.04, 0.015), c.r8, -0.1, G + 0.15, 0.32);
    k.M(k.box(0.2, 0.18, 0.04, 0.015), c.pw, 0.2, G + 0.3, 0.32);
    k.M(k.box(0.2, 0.18, 0.04, 0.015), c.pw, -0.4, G + 0.3, 0.32);
    var arr = k.G(0.2, G + 0.75, -0.05);
    arr.rotation.z = -0.6435;
    k.M(k.box(0.52, 0.035, 0.32, 0.014), c.n5, 0, 0, 0.18, arr);
    k.M(k.box(0.52, 0.035, 0.32, 0.014), c.n5, 0, 0, -0.18, arr);
    k.M(k.box(0.012, 0.02, 0.68, 0.005), c.cream, 0, 0.022, 0, arr);
    k.M(k.box(0.5, 0.02, 0.012, 0.005), c.cream, 0, 0.022, 0.18, arr);
    k.M(k.box(0.5, 0.02, 0.012, 0.005), c.cream, 0, 0.022, -0.18, arr);
    var orbit = k.G(-0.1, G + 0.45, -0.3);
    var sun = k.G(0, 1.0, 0, orbit);
    k.M(k.sph(0.17), c.pw, 0, 0, 0, sun, 0.8);
    var rays = k.G(0, 0, 0, sun);
    for (i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var r = k.M(k.box(0.08, 0.025, 0.025, 0.01), c.pw, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0, rays, 0.8);
      r.rotation.z = a;
    }
    k.M(k.box(0.24, 0.42, 0.18, 0.04), c.cream, 0.74, G + 0.21, 0.42);
    k.M(k.box(0.08, 0.04, 0.08, 0.015), c.n3, 0.74, G + 0.44, 0.42);
    var bars = [];
    for (i = 0; i < 3; i++) {
      var bg = k.G(0.74, G + 0.1 + i * 0.11, 0.515);
      k.M(k.box(0.16, 0.07, 0.02, 0.008), c.r3, 0, 0, 0, bg, 0.5);
      bars.push(bg);
    }
    k.M(k.cyl(0.02, 0.02, 0.3, 8), c.cream, -0.76, G + 0.15, 0.46);
    var face = k.M(k.cyl(0.16, 0.16, 0.06, 28), c.pw, -0.76, G + 0.42, 0.46); face.rotation.x = Math.PI / 2;
    k.M(k.tor(0.16, 0.022), c.r8, -0.76, G + 0.42, 0.49);
    var hand = k.G(-0.76, G + 0.42, 0.5);
    k.M(k.box(0.022, 0.11, 0.02, 0.008), c.red, 0, 0.05, 0, hand);
    return function (t) {
      orbit.rotation.z = 0.75 * Math.sin(t * 0.45);
      rays.rotation.z = t * 0.9;
      arr.rotation.z = -0.6435 + 0.07 * Math.sin(t * 0.45);
      hand.rotation.z = -t * 1.2;
      var ph = (t * 0.5) % 1;
      for (var i = 0; i < 3; i++) {
        var s = (ph - i * 0.25) / 0.12;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        bars[i].scale.setScalar(0.001 + s);
      }
    };
  }

  _inspection(k) {
    var G = -0.9, c = this._C(), i;
    k.puck(c.c5);
    var clip = k.G(-0.2, G, -0.15);
    clip.rotation.x = -0.28;
    k.M(k.box(0.82, 1.08, 0.06, 0.04), c.n5, 0, 0.56, 0, clip);
    k.M(k.box(0.68, 0.88, 0.02, 0.008), c.pw, 0, 0.52, 0.04, clip);
    k.M(k.box(0.3, 0.12, 0.07, 0.03), c.red, 0, 1.04, 0.03, clip);
    var ticks = [];
    for (i = 0; i < 3; i++) {
      var y = 0.78 - i * 0.24;
      k.M(k.box(0.11, 0.11, 0.02, 0.008), c.n3, -0.22, y, 0.055, clip);
      k.M(k.box(0.34, 0.035, 0.02, 0.008), c.c5, 0.1, y + 0.03, 0.055, clip);
      k.M(k.box(0.22, 0.03, 0.02, 0.008), c.c5, 0.04, y - 0.04, 0.055, clip);
      var tg = k.G(-0.22, y, 0.075, clip);
      var t1 = k.M(k.box(0.032, 0.08, 0.02, 0.008), c.red, -0.035, -0.012, 0, tg); t1.rotation.z = 0.75;
      var t2 = k.M(k.box(0.032, 0.15, 0.02, 0.008), c.red, 0.03, 0.02, 0, tg); t2.rotation.z = -0.6;
      ticks.push(tg);
    }
    var mag = k.G(-0.2, G + 0.75, 0.3);
    k.M(k.tor(0.19, 0.035), c.red, 0, 0, 0, mag);
    var hd = k.M(k.cap(0.035, 0.26), c.n5, 0.24, -0.26, 0, mag); hd.rotation.z = 0.75;
    k.M(k.cyl(0.025, 0.025, 0.5, 8), c.n5, 0.74, G + 0.25, 0.4);
    k.M(k.box(0.22, 0.03, 0.03, 0.012), c.n5, 0.65, G + 0.5, 0.4);
    var swing = k.G(0.56, G + 0.5, 0.4);
    k.M(k.tor(0.09, 0.016), c.n5, 0, -0.09, 0, swing);
    var k1 = k.G(0, -0.16, 0, swing);
    k1.rotation.z = 0.2;
    k.M(k.tor(0.07, 0.026), c.red, 0, -0.08, 0, k1);
    k.M(k.box(0.036, 0.3, 0.03, 0.012), c.red, 0, -0.3, 0, k1);
    k.M(k.box(0.07, 0.04, 0.03, 0.012), c.red, 0.04, -0.42, 0, k1);
    k.M(k.box(0.06, 0.04, 0.03, 0.012), c.red, 0.035, -0.34, 0, k1);
    var k2 = k.G(0, -0.16, 0.03, swing);
    k2.rotation.z = -0.4;
    k.M(k.tor(0.055, 0.022), c.n3, 0, -0.07, 0, k2);
    k.M(k.box(0.03, 0.22, 0.026, 0.01), c.n3, 0, -0.24, 0, k2);
    k.M(k.box(0.05, 0.035, 0.026, 0.01), c.n3, 0.03, -0.32, 0, k2);
    var pen = k.M(k.cap(0.03, 0.4), c.red, -0.25, G + 0.035, 0.72); pen.rotation.z = Math.PI / 2;
    return function (t) {
      mag.position.x = -0.2 + 0.3 * Math.sin(t * 0.9);
      mag.position.y = G + 0.72 + 0.2 * Math.sin(t * 1.3);
      swing.rotation.z = 0.28 * Math.sin(t * 2);
      var ph = (t * 0.3) % 1;
      for (var i = 0; i < 3; i++) {
        var s = (ph - 0.12 - i * 0.2) / 0.08;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        ticks[i].scale.setScalar(0.001 + s * (1 + 0.35 * Math.sin(s * Math.PI)));
      }
    };
  }

  _happy(k) {
    var c = this._C(), i;
    var all = k.G(0, 0, 0);
    k.M(k.sph(0.9, 44), c.cream, 0, 0, 0, all);
    var eyes = [];
    for (i = -1; i <= 1; i += 2) {
      var eg = k.G(i * 0.3, 0.14, 0.855, all);
      eg.rotation.set(-0.14, i * 0.34, 0);
      k.M(k.tor(0.13, 0.046, Math.PI), c.r8, 0, 0, 0, eg);
      eyes.push(eg);
      var ch = k.M(k.sph(0.14), c.r3, i * 0.54, -0.14, 0.68, all);
      ch.scale.set(1, 0.9, 0.4);
      ch.rotation.y = i * 0.65;
    }
    var mouth = k.G(0, 0, 0, all);
    var mp = [];
    for (i = 0; i <= 10; i++) {
      var mx = -0.36 + i * 0.072;
      var my = -0.08 - 0.22 * (1 - (mx / 0.36) * (mx / 0.36));
      mp.push([mx, my, Math.sqrt(Math.max(0.01, 0.81 - mx * mx - my * my)) + 0.012]);
    }
    k.M(k.tube(k.curve(mp), 0.04), c.r8, 0, 0, 0, mouth);
    k.M(k.sph(0.05), c.r8, mp[0][0], mp[0][1], mp[0][2], mouth);
    k.M(k.sph(0.05), c.r8, mp[10][0], mp[10][1], mp[10][2], mouth);
    var heart = [[0, -0.12], [-0.11, -0.02], [-0.13, 0.05], [-0.1, 0.11], [-0.05, 0.12], [0, 0.07], [0.05, 0.12], [0.1, 0.11], [0.13, 0.05], [0.11, -0.02]];
    var h1 = k.G(1.05, 0.62, 0.2);
    k.M(k.ext(heart, 0.07, 0.025), c.pw, 0, 0, 0, h1);
    var h2 = k.G(-1.08, -0.35, 0.3);
    var hm = k.M(k.ext(heart, 0.07, 0.025), c.cream, 0, 0, 0, h2); hm.scale.setScalar(0.75);
    var sparks = [], sp = [[-0.95, 0.75, 0.1], [1.1, -0.45, 0.2], [0.75, 1.0, -0.1]];
    for (i = 0; i < 3; i++) {
      var sg = k.G(sp[i][0], sp[i][1], sp[i][2]);
      var d = k.M(k.box(0.1, 0.1, 0.04, 0.012), c.pw, 0, 0, 0, sg, 0.6);
      d.rotation.z = Math.PI / 4;
      sparks.push(sg);
    }
    return function (t) {
      all.position.y = 0.05 * Math.sin(t * 1.8);
      all.rotation.z = 0.06 * Math.sin(t * 1.1);
      var blink = Math.sin(t * 2.4) > 0.93 ? 0.35 : 1;
      eyes[0].scale.y = blink;
      eyes[1].scale.y = blink;
      mouth.scale.x = 1 + 0.06 * Math.sin(t * 1.8);
      h1.position.y = 0.62 + 0.1 * Math.sin(t * 1.5);
      h1.rotation.y = 0.6 * Math.sin(t * 1.2);
      h2.position.y = -0.35 + 0.1 * Math.sin(t * 1.3 + 2);
      h2.rotation.y = 0.6 * Math.sin(t * 1.0 + 1);
      for (var i = 0; i < 3; i++) sparks[i].scale.setScalar(0.5 + 0.5 * Math.abs(Math.sin(t * 2 + i * 1.7)));
    };
  }

  // Where each piece sits: x as a fraction of the width, y as a fraction of its section.
  _layout() {
    return [
      { x: 0.87, y: 0.26, build: '_house' },
      { x: 0.12, y: 0.74, build: '_design', yaw: -0.45 },
      { x: 0.78, y: 0.58, build: '_foundation' },
      { x: 0.2, y: 0.28, build: '_construction' },
      { x: 0.5, y: 0.62, build: '_plumbing', yaw: -0.4 },
      { x: 0.9, y: 0.3, build: '_airflow' },
      { x: 0.1, y: 0.62, build: '_electrical', yaw: -0.45 },
      { x: 0.56, y: 0.28, build: '_solar', yaw: -0.5 },
      { x: 0.84, y: 0.72, build: '_inspection', yaw: -0.35, tilt: 0.3 },
      { x: 0.22, y: 0.5, build: '_happy', yaw: -0.15, tilt: 0.08 }
    ];
  }

  // ---------- engine ----------

  _setup(canvas) {
    var T = window.THREE;
    if (!T) return false;
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.NoToneMapping;

    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(0, 1, 0, -1, 1, 6000);
    cam.position.set(0, 0, 3000);
    scene.add(new T.HemisphereLight(0xfff6ea, 0x565c78, 1.7));
    var key = new T.DirectionalLight(0xffffff, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 1.5;
    key.shadow.radius = 5;
    scene.add(key);
    scene.add(key.target);
    var rim = new T.DirectionalLight(0xffe9d6, 0.6);
    rim.position.set(900, 250, 500);
    scene.add(rim);

    this._bump = this._bumpTex();
    var layout = this._layout();
    var pieces = [];
    for (var i = 0; i < layout.length; i++) {
      var group = new T.Group();
      var inner = new T.Group();
      group.add(inner);
      var blob = new T.Mesh(new T.CircleGeometry(1.2, 40),
        new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
      blob.scale.set(1, 0.3, 1);
      blob.position.set(0.08, -1.42, -1.6);
      group.add(blob);
      var spec = Object.assign({}, layout[i], (this.props.layout && this.props.layout[i]) || {});
      var piece = { group: group, inner: inner, blob: blob, parts: [], idx: i, spec: spec, anim: null };
      piece.anim = this[layout[i].build](this._kit(piece));
      for (var j = 0; j < piece.parts.length; j++) {
        var m = piece.parts[j];
        m.userData.o = piece.parts.length > 1 ? j / (piece.parts.length - 1) : 0;
        m.userData.s0 = m.scale.clone();
      }
      scene.add(group);
      pieces.push(piece);
    }

    var cordMat = new T.MeshStandardMaterial({ color: 0xB11722, roughness: 0.92, metalness: 0, bumpMap: this._bump, bumpScale: 0.35 });
    var capGeo = new T.SphereGeometry(1, 14, 10);
    var capA = new T.Mesh(capGeo, cordMat), capB = new T.Mesh(capGeo, cordMat);
    scene.add(capA);
    scene.add(capB);

    this._gl = {
      renderer: renderer, scene: scene, cam: cam, key: key, pieces: pieces,
      cordMat: cordMat, cord: null, cordY: null, capA: capA, capB: capB, W: 0, H: 0, vh: 0
    };
    return true;
  }

  // Runs when the page size changes: place the pieces and lay the cord.
  _resize(W, H, viewH) {
    var T = window.THREE, gl = this._gl;
    gl.W = W; gl.H = H; gl.vh = viewH;
    var dpr = Math.min(window.devicePixelRatio || 1, W < 768 ? 1.5 : 2, 4096 / viewH, 4096 / W, Math.sqrt(6e6 / (W * viewH)));
    gl.renderer.setPixelRatio(dpr);
    gl.renderer.setSize(W, viewH, false);
    var sec = H / 10;
    var side = Math.max(150, Math.min(520, Math.sqrt(0.15 * W * sec))) * (W >= 900 ? 0.6 : W < 768 ? 0.5 : 1);
    var unit = side / 2.8;
    gl.side = side; gl.sec = sec; gl.unit = unit;
    var pts = [];
    for (var i = 0; i < gl.pieces.length; i++) {
      var p = gl.pieces[i];
      // Mechbridge site: phones use their own layout (pieces in a band at the top of each section).
      var sp = (W < 768 && this.props.mobileLayout && this.props.mobileLayout[i]) || p.spec;
      var x = Math.max(side / 2 + 8, Math.min(W - side / 2 - 8, sp.x * W));
      var top = this._band(i) * H, sh = (this._band(i + 1) - this._band(i)) * H;
      var y = sp.ypx != null ? top + sp.ypx : top + sp.y * sh;
      p.x = x; p.y = y;
      p.group.position.set(x, -y, 0);
      p.group.scale.setScalar(unit);
    }
    for (i = 0; i < gl.pieces.length; i++) {
      var a = gl.pieces[i], b = gl.pieces[i + 1];
      var outA = a.x > W / 2 ? 1 : -1;
      if (i === 0) pts.push([a.x + outA * side * 0.2, -30], [a.x, a.y - side * 0.36]);
      if (b) {
        pts.push([a.x, a.y + side * 0.36]);
        var edge = this._band(i + 1) * H;
        var outB = b.x > W / 2 ? 1 : -1;
        pts.push([Math.max(12, Math.min(W - 12, a.x + outA * side * 0.3)), edge - sec * 0.14]);
        pts.push([W / 2, edge]);
        pts.push([Math.max(12, Math.min(W - 12, b.x + outB * side * 0.3)), edge + sec * 0.14]);
        pts.push([b.x, b.y - side * 0.36]);
      }
    }
    if (gl.cord) {
      gl.scene.remove(gl.cord);
      gl.cord.geometry.dispose();
      gl.cord = null;
    }
    if (pts.length > 2) {
      var v = [];
      for (i = 0; i < pts.length; i++) v.push(new T.Vector3(pts[i][0], -pts[i][1], -unit * 2.2 + 12 * Math.sin(i * 1.7)));
      var curve = new T.CatmullRomCurve3(v, false, 'catmullrom', 0.5);
      var segs = 520 * gl.pieces.length;
      var rad = Math.max(3, unit * 0.034);
      var geo = new T.TubeGeometry(curve, segs, rad, 8, false);
      gl.cord = new T.Mesh(geo, gl.cordMat);
      gl.cord.castShadow = false;
      gl.scene.add(gl.cord);
      gl.cordY = [];
      gl.cordP = [];
      // Per-section cord colours, used when the whole page is shown at once.
      var tint = new Float32Array((segs + 1) * 9 * 3), tc = new T.Color();
      for (i = 0; i <= segs; i++) {
        var q = curve.getPointAt(i / segs);
        gl.cordP.push(q);
        gl.cordY.push(-q.y);
        var cc = this._colours(Math.max(0, Math.min(9.99, this._pos(-q.y, H))))[1];
        tc.setRGB(cc[0] / 255, cc[1] / 255, cc[2] / 255, 'srgb');
        for (var r9 = 0; r9 < 9; r9++) {
          var o3 = (i * 9 + r9) * 3;
          tint[o3] = tc.r; tint[o3 + 1] = tc.g; tint[o3 + 2] = tc.b;
        }
      }
      geo.setAttribute('color', new T.BufferAttribute(tint, 3));
      gl.cordSegs = segs;
      gl.capA.scale.setScalar(rad);
      gl.capB.scale.setScalar(rad);
    }
    var ext = Math.max(W, viewH) * 0.62 + 200;
    var sc = gl.key.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 6000;
    sc.updateProjectionMatrix();
  }

  _back(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  _clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  _tick(t) {
    if (!this._alive) return;
    this._raf = requestAnimationFrame(this._loop);
    var root = this._root, canvas = this._canvas;
    if (!root || !canvas) return;
    var rr = root.getBoundingClientRect();
    var W = rr.width, H = rr.height;
    if (!W || !H) return;
    var winH = window.innerHeight || document.documentElement.clientHeight || H;
    var viewH = Math.min(winH, H);
    var mode = this._mode || 'scroll';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var S = this._stops();

    if (!this._gl && !this._dead) {
      if (!this._setup(canvas)) this._dead = true;
    }
    var gl = this._gl;
    if (!gl) {
      // No WebGL: keep the shifting ground colour only.
      var pos0 = this._pos(Math.max(0, -rr.top) + viewH / 2, H);
      this._paint(root, this._shift ? this._colours(pos0)[0] : S.ground[0]);
      return;
    }

    var bk = String(this.props.bands || '');
    if (Math.abs(W - gl.W) > 0.5 || Math.abs(H - gl.H) > 0.5 || Math.abs(viewH - gl.vh) > 0.5 || bk !== gl.bk) {
      gl.bk = bk;
      canvas.style.height = viewH + 'px';
      this._resize(W, H, viewH);
      this._lastKey = '';
    }

    var dt = this._lastT == null ? 16 : Math.min(100, t - this._lastT);
    this._lastT = t;
    var viewTop = Math.round(Math.max(0, Math.min(H - viewH, -rr.top)));
    var still = mode === 'static' || reduced;
    // The whole page fits on screen (the canvas overview): show all ten sections at once.
    var overview = mode !== 'autoplay' && H <= winH + 24;
    var lo, hi, centre;
    if (still || overview) {
      lo = -1e6; hi = 1e6;
      centre = viewTop + viewH / 2;
    } else {
      var target, band;
      if (mode === 'autoplay' || H <= winH + 24) {
        // Nothing to scroll: glide a virtual viewport down the page, then loop.
        band = Math.min(viewH, gl.sec * 1.15);
        if (this._t0 == null) this._t0 = t;
        var e = (t - this._t0) % 46000;
        target = -0.5 * band + Math.min(1, e / 42000) * (H - 0.5 * band);
        if (this._cur != null && target < this._cur - band) this._cur = target;
      } else {
        band = viewH;
        target = -rr.top;
        this._t0 = null;
      }
      if (this._cur == null) this._cur = target - 0.6 * band;
      var cur = this._cur + (target - this._cur) * (1 - Math.exp(-dt / 110));
      if (Math.abs(target - cur) < 0.05) cur = target;
      this._cur = cur;
      // Only pieces between these two lines are built; above the band they squash away.
      lo = cur + 0.06 * band;
      hi = cur + Math.max(0.86 * band, gl.side * 1.3);
      centre = cur + 0.5 * band;
    }

    var step = still ? 0 : (this._stop ? Math.floor(t / 1000 * 12) : t);
    var tq = still ? 0 : (this._stop ? step / 12 : t / 1000);
    var key = [viewTop.toFixed(1), (this._cur || 0).toFixed(1), step, mode, overview, this._shift].join('|');
    if (key === this._lastKey) return;
    this._lastKey = key;

    var cols = this._shift ? this._colours(this._pos(centre, H)) : [S.ground[0], S.cord[0]];
    var banded = overview && this._shift;
    if (banded !== !!gl.banded) {
      gl.banded = banded;
      gl.cordMat.vertexColors = banded;
      gl.cordMat.needsUpdate = true;
      if (banded) {
        var stopsCss = [];
        for (var b = 0; b < 10; b++) {
          var gc = 'rgb(' + S.ground[b].join(',') + ')';
          stopsCss.push(gc + ' ' + (b * 10) + '%', gc + ' ' + ((b + 1) * 10) + '%');
        }
        root.style.background = 'linear-gradient(to bottom, ' + stopsCss.join(', ') + ')';
      } else {
        root.style.background = '';
      }
    }
    this._paint(root, cols[0]);
    if (banded) gl.cordMat.color.setRGB(1, 1, 1);
    else gl.cordMat.color.setRGB(cols[1][0] / 255, cols[1][1] / 255, cols[1][2] / 255, 'srgb');

    gl.cam.left = 0; gl.cam.right = W; gl.cam.top = -viewTop; gl.cam.bottom = -(viewTop + viewH);
    gl.cam.updateProjectionMatrix();
    // Move the light in whole shadow-map texels so shadow edges never crawl while scrolling.
    var tx = W / 2, ty = -(viewTop + viewH / 2);
    var ld = new window.THREE.Vector3(-900, 1500, 1400).normalize();
    var lr = new window.THREE.Vector3(0, 1, 0).cross(ld).normalize();
    var lu = new window.THREE.Vector3().crossVectors(ld, lr);
    var texel = 2 * gl.key.shadow.camera.right / gl.key.shadow.mapSize.x;
    var pr = tx * lr.x + ty * lr.y, pu = tx * lu.x + ty * lu.y;
    var dr = Math.round(pr / texel) * texel - pr, du = Math.round(pu / texel) * texel - pu;
    tx += dr * lr.x + du * lu.x;
    ty += dr * lr.y + du * lu.y;
    var tz = dr * lr.z + du * lu.z;
    gl.key.target.position.set(tx, ty, tz);
    gl.key.position.set(tx - 900 * 1, ty + 1500, tz + 1400);
    gl.key.target.updateMatrixWorld();

    for (var i = 0; i < gl.pieces.length; i++) {
      var p = gl.pieces[i];
      var top = p.y - gl.side / 2;
      var f = this._clamp((hi - top) / gl.side);
      var g = this._clamp((lo - top) / gl.side);
      var onScreen = p.y + gl.side > viewTop && p.y - gl.side < viewTop + viewH;
      var show = f > 0 && g < 1 && onScreen;
      p.group.visible = show;
      if (!show) continue;
      var grow = 0;
      for (var j = 0; j < p.parts.length; j++) {
        var m = p.parts[j], o = m.userData.o;
        var tin = this._clamp((f - o * 0.6) / 0.4);
        // Leaving runs in reverse: small parts go first, the base goes last.
        var tout = this._clamp((g - (1 - o) * 0.6) / 0.4);
        var s = this._back(tin) * (1 - tout * tout);
        if (tin <= 0) s = 0;
        if (j === 0) grow = s;
        m.visible = s > 0.002;
        if (m.visible) m.scale.copy(m.userData.s0).multiplyScalar(s);
      }
      p.blob.material.opacity = 0.2 * Math.min(1, grow);
      var boil = this._stop && !reduced ? (Math.sin(step * 12.9898 + i * 78.233) * 43758.5453 % 1) * 0.012 : 0;
      p.inner.rotation.set(p.spec.tilt == null ? 0.5 : p.spec.tilt, (p.spec.yaw == null ? -0.6 : p.spec.yaw) + 0.2 * Math.sin(tq * 0.5 + i * 1.3), boil);
      if (p.anim) p.anim(tq);
    }

    if (gl.cord) {
      var a0 = 0, a1 = gl.cordSegs;
      while (a0 < gl.cordSegs && gl.cordY[a0] < lo) a0++;
      while (a1 > 0 && gl.cordY[a1] > hi) a1--;
      var has = a1 > a0;
      gl.cord.visible = has;
      gl.capA.visible = has && !gl.banded;
      gl.capB.visible = has && !gl.banded;
      if (has) {
        gl.cord.geometry.setDrawRange(a0 * 48, (a1 - a0) * 48);
        gl.capA.position.copy(gl.cordP[a0]);
        gl.capB.position.copy(gl.cordP[a1]);
      }
    }

    gl.renderer.render(gl.scene, gl.cam);
  }

  renderVals() {
    var self = this;
    if (!this._setRoot) {
      this._setRoot = function (el) { if (el) self._root = el; };
      this._setCanvas = function (el) { if (el) self._canvas = el; };
    }
    this._mode = String(this.props.motion ?? 'Scroll').toLowerCase();
    this._stop = this.props.stopMotion === true;
    this._shift = (this.props.colorShift ?? true) !== false;
    return { setRoot: this._setRoot, setCanvas: this._setCanvas };
  }
}

  // mount(root, canvas, props) -> the component instance.
  // root: tall element (its height is split into 10 equal sections). canvas: sticky, 100vh.
  // props: { motion: 'Scroll'|'Autoplay'|'Static', stopMotion: bool, colorShift: bool }
  window.MechBridgeBackground = {
    mount: function (root, canvas, props) {
      var c = new Component();
      c.props = props || {};
      var v = c.renderVals();
      v.setRoot(root);
      v.setCanvas(canvas);
      c.componentDidMount();
      return c;
    }
  };
})();
