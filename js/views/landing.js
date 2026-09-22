/**
 * Interactive Canvas Landing Page View - SBAFA
 * Theme: Modern Minimalist
 * Background: Mouse-reactive + scroll-warped particle mesh (pure Canvas 2D, zero deps)
 */

import { getCurrentUser } from '../db.js';

// ──────────────────────────────────────────────────────────
// Canvas Particle Engine
// ──────────────────────────────────────────────────────────
function createParticleMesh(canvas) {
  const ctx = canvas.getContext('2d');
  let W = canvas.offsetWidth;
  let H = canvas.offsetHeight;
  let raf = null;

  // Mouse state (normalized -1…1 from center)
  const mouse = { x: 0, y: 0, vx: 0, vy: 0 };
  // Scroll parallax factor (0…1)
  let scrollFactor = 0;

  // ── Config ────────────────────────────────────────────────
  const PARTICLE_COUNT = 88;
  const CONNECTION_DIST = 130;
  const MOUSE_RADIUS = 140;
  const MOUSE_REPEL = 0.28;       // repulsion strength
  const DRIFT_SPEED = 0.28;       // base drift px/frame
  const PARALLAX_STRENGTH = 28;   // max px shift on mouse move
  const SCROLL_WARP = 0.5;        // scroll parallax intensity

  // ── Colors ────────────────────────────────────────────────
  const COLOR_NODE   = 'rgba(255,255,255,XXX)';   // XXX = dynamic
  const COLOR_EDGE   = 'rgba(255,255,255,YYY)';

  // ── Particle factory ──────────────────────────────────────
  function makeParticle() {
    const depth = 0.3 + Math.random() * 0.7; // z-depth 0.3–1.0
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      ox: 0, oy: 0,     // offset applied by mouse/scroll
      vx: (Math.random() - 0.5) * DRIFT_SPEED,
      vy: (Math.random() - 0.5) * DRIFT_SPEED,
      r: 1.2 + depth * 1.6,
      depth,
      alpha: 0.15 + depth * 0.55,
    };
  }

  let particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);

  // ── Resize handler ────────────────────────────────────────
  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ── Mouse handler ─────────────────────────────────────────
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    // Normalized -1…1 relative to canvas center
    mouse.x = ((e.clientX - rect.left) / W - 0.5) * 2;
    mouse.y = ((e.clientY - rect.top)  / H - 0.5) * 2;
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((t.clientX - rect.left) / W - 0.5) * 2;
    mouse.y = ((t.clientY - rect.top)  / H - 0.5) * 2;
  }

  // Scroll handler on the parent scroll container
  function onScroll(e) {
    const el = e.currentTarget || e.target;
    const maxScroll = el.scrollHeight - el.clientHeight;
    scrollFactor = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
  }

  const appMain = document.getElementById('view-container');
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  if (appMain) appMain.addEventListener('scroll', onScroll, { passive: true });

  // ── Draw helpers ──────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Smooth mouse velocity (lerp)
    mouse.vx += (mouse.x - mouse.vx) * 0.08;
    mouse.vy += (mouse.y - mouse.vy) * 0.08;

    // Cursor screen-space position
    const cursorX = (mouse.vx * 0.5 + 0.5) * W;
    const cursorY = (mouse.vy * 0.5 + 0.5) * H;

    particles.forEach(p => {
      // Base drift
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around bounds
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      // Mouse parallax offset (deeper particles move more)
      p.ox = -mouse.vx * PARALLAX_STRENGTH * p.depth;
      p.oy = -mouse.vy * PARALLAX_STRENGTH * p.depth;

      // Scroll parallax (particles drift upward as user scrolls)
      p.oy += scrollFactor * SCROLL_WARP * H * 0.18 * p.depth;

      // Mouse repulsion (surface-level push)
      const dx = p.x + p.ox - cursorX;
      const dy = p.y + p.oy - cursorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
        p.ox += (dx / dist) * force * MOUSE_RADIUS * MOUSE_REPEL;
        p.oy += (dy / dist) * force * MOUSE_RADIUS * MOUSE_REPEL;
      }
    });

    // ── Draw edges ────────────────────────────────────────
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      const ax = a.x + a.ox;
      const ay = a.y + a.oy;
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const bx = b.x + b.ox;
        const by = b.y + b.oy;
        const ddx = ax - bx;
        const ddy = ay - by;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < CONNECTION_DIST) {
          const t = 1 - d / CONNECTION_DIST;
          // Check cursor proximity for edge glow
          const midX = (ax + bx) / 2;
          const midY = (ay + by) / 2;
          const cdx = midX - cursorX;
          const cdy = midY - cursorY;
          const cursorDist = Math.sqrt(cdx * cdx + cdy * cdy);
          const glowBoost = Math.max(0, 1 - cursorDist / (MOUSE_RADIUS * 1.5));

          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          const edgeRgb = isLight ? '51, 65, 85' : '255, 255, 255';
          const baseAlpha = isLight
            ? (t * 0.22 * Math.min(a.depth, b.depth) + 0.08)
            : (t * 0.12 * Math.min(a.depth, b.depth));
          const alpha = Math.min(0.65, baseAlpha + glowBoost * 0.35);

          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(${edgeRgb},${alpha.toFixed(3)})`;
          ctx.lineWidth = isLight ? (0.8 + glowBoost * 0.8) : (0.6 + glowBoost * 0.6);
          ctx.stroke();
        }
      }
    }

    // ── Draw nodes ────────────────────────────────────────
    particles.forEach(p => {
      const px = p.x + p.ox;
      const py = p.y + p.oy;

      // Cursor proximity glow
      const dx = px - cursorX;
      const dy = py - cursorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glowBoost = Math.max(0, 1 - dist / MOUSE_RADIUS);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const nodeRgb = isLight ? '15, 23, 42' : '255, 255, 255';
      const haloRgb = isLight ? '37, 99, 235' : '255, 255, 255';
      const alpha = isLight
        ? Math.min(0.95, p.alpha + 0.25 + glowBoost * 0.5)
        : Math.min(0.95, p.alpha + glowBoost * 0.5);
      const radius = p.r + (isLight ? 0.3 : 0) + glowBoost * 1.8;

      // Glow halo near cursor
      if (glowBoost > 0.1) {
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius * 4);
        grad.addColorStop(0, `rgba(${haloRgb},${(glowBoost * (isLight ? 0.22 : 0.12)).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${haloRgb},0)`);
        ctx.beginPath();
        ctx.arc(px, py, radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${nodeRgb},${alpha.toFixed(3)})`;
      ctx.fill();
    });

    raf = requestAnimationFrame(draw);
  }

  // Slight fade-in on start
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.2s ease';
  setTimeout(() => { canvas.style.opacity = '1'; }, 60);

  draw();

  // ── Cleanup ───────────────────────────────────────────────
  return function cleanup() {
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
    if (appMain) appMain.removeEventListener('scroll', onScroll);
  };
}

// ──────────────────────────────────────────────────────────
// View Renderer
// ──────────────────────────────────────────────────────────
let _meshCleanup = null;

export async function renderLanding(container) {
  // Teardown any previous canvas loop
  if (_meshCleanup) { _meshCleanup(); _meshCleanup = null; }

  const currentUser = await getCurrentUser();
  const ctaRoute = currentUser ? '/dashboard' : '/login';
  const ctaText  = currentUser ? 'Enter Dashboard →' : 'Launch Vault →';

  container.innerHTML = `
    <div class="landing-view-container">

      <!-- ── Hero Section with Interactive Canvas ────────────────── -->
      <section class="landing-hero" id="landing-hero-sec">

        <!-- Canvas Background Layer -->
        <canvas id="hero-mesh-canvas" class="landing-canvas-bg" aria-hidden="true"></canvas>

        <!-- Ambient gradient orbs behind content -->
        <div class="landing-orb landing-orb-1"></div>
        <div class="landing-orb landing-orb-2"></div>

        <!-- Gradient Scrim for text contrast -->
        <div class="landing-hero-scrim"></div>

        <!-- Foreground Hero Content -->
        <div class="landing-hero-content">
          <!-- Geometric Contour Star Emblem (Meetgen Style) with SBAFA_Logo.svg -->
          <div class="landing-sketch-card">
            <img src="icons/SBAFA_Logo.svg" alt="SBAFA Emblem" class="landing-sketch-svg" style="width: 150px; height: 150px; border-radius: 34px; box-shadow: 0 16px 40px rgba(224, 76, 0, 0.4); display: block;" />
          </div>

          <div class="landing-badge">
            <span class="landing-badge-dot"></span>
            <span>Personal Finance Vault &nbsp;·&nbsp; Zero Telemetry</span>
          </div>

          <h1 class="landing-hero-title">
            Track your financial flow in zero seconds.
          </h1>

          <p class="landing-hero-subtitle">
            Direct bank statement imports, offline IndexedDB ledger, and automated monthly spending caps.
          </p>

          <div class="landing-cta-group">
            <button id="landing-launch-btn" class="btn btn-primary btn-lg" style="border-radius: var(--radius-full); padding: 14px 32px; font-size: 15px; font-weight: 700;">
              ${ctaText}
            </button>
            ${!currentUser ? `
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                Have an account? <a href="/login" style="color: var(--accent-primary); font-weight: 700; text-decoration: none;">Login</a>
              </div>
            ` : ''}
          </div>

          <div class="landing-trust-row">
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>100% Client&#8209;Side</span>
            </div>
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>Direct Statements</span>
            </div>
            <div class="trust-item">
              <span class="trust-check">✓</span>
              <span>Zero Cloud Telemetry</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Core Engineering Primitives ─────────────────────────── -->
      <section>
        <div style="margin-bottom: 18px;">
          <h2 class="landing-section-title">Core Engineering Primitives</h2>
          <p class="landing-section-desc">
            SBAFA eliminates cloud middlemen entirely. Your data is created, indexed, encrypted, and analyzed directly in your browser sandbox.
          </p>
        </div>

        <div class="feature-grid-minimal">
          <div class="feature-card-minimal">
            <div>
              <div class="feature-card-icon">🔐</div>
              <h3 class="feature-card-title">Encrypted Local Vault</h3>
              <p class="feature-card-text">
                IndexedDB storage fortified with 256-bit AES-GCM and device biometrics (TouchID / FaceID). Your bank statements never touch a remote server.
              </p>
            </div>
            <div class="feature-card-tag">PROTOCOL: WEBCRYPTO / DEXIE</div>
          </div>

          <div class="feature-card-minimal">
            <div>
              <div class="feature-card-icon">📬</div>
              <h3 class="feature-card-title">Gmail Statement Auto-Pull</h3>
              <p class="feature-card-text">
                Secure, direct email statement fetch via Google OAuth. Automatic weekly sync searches for e-statements with zero regulatory AA middlemen and zero server telemetry.
              </p>
            </div>
            <div class="feature-card-tag">PROTOCOL: GMAIL REST / CLIENT OAUTH</div>
          </div>

          <div class="feature-card-minimal">
            <div>
              <div class="feature-card-icon">📄</div>
              <h3 class="feature-card-title">In-Browser PDF Parsing</h3>
              <p class="feature-card-text">
                Client-side WebAssembly PDF.js engine extracts password-protected Indian bank statements in under 300ms with automated IFSC and merchant tagging.
              </p>
            </div>
            <div class="feature-card-tag">ENGINE: LOCAL WASM PDF.JS</div>
          </div>

          <div class="feature-card-minimal">
            <div>
              <div class="feature-card-icon">⚡</div>
              <h3 class="feature-card-title">Offline-First Service Worker</h3>
              <p class="feature-card-text">
                Log transactions on an airplane or subway without internet. Background Sync seamlessly flushes your local transaction queue once connectivity resumes.
              </p>
            </div>
            <div class="feature-card-tag">STORAGE: BACKGROUND SYNC QUEUE</div>
          </div>
        </div>
      </section>

      <!-- ── Architecture Comparison ─────────────────────────────── -->
      <section class="arch-card" id="landing-arch-sec">
        <h2 class="landing-section-title">Architectural Contrast</h2>
        <p class="landing-section-desc">
          How SBAFA guarantees sovereign privacy compared to traditional cloud budgeting apps.
        </p>

        <div style="overflow-x: auto;">
          <table class="arch-table">
            <thead>
              <tr>
                <th style="width: 30%;">Vector</th>
                <th style="width: 35%;">Traditional SaaS Budget Apps</th>
                <th style="width: 35%; color: var(--text-primary);">SBAFA Enclave</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600;">Data Residency</td>
                <td class="highlight-bad">AWS / Cloud Relational DB</td>
                <td class="highlight-good">100% Local Device IndexedDB</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Bank Credentials</td>
                <td class="highlight-bad">Scraped via NetBanking Screen-Scrapers</td>
                <td class="highlight-good">RBI Sahamati Consent Manager Token</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Statement PDF Processing</td>
                <td class="highlight-bad">Sent to OCR Server Pipeline</td>
                <td class="highlight-good">Parsed In-Memory with Client WebWorker</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Telemetry &amp; Ads</td>
                <td class="highlight-bad">Segment, Mixpanel, Google Ads SDK</td>
                <td class="highlight-good">Zero Telemetry • Zero Third-Party Trackers</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Offline Availability</td>
                <td class="highlight-bad">Fails without Active Internet</td>
                <td class="highlight-good">Full PWA Offline Read/Write Engine</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Bottom CTA ───────────────────────────────────────────── -->
      <section class="landing-bottom-cta">
        <h2 class="landing-bottom-cta-title">Take Complete Financial Ownership.</h2>
        <p class="landing-bottom-cta-sub">
          No sign-ups requiring external servers. Create your private biometric vault on this device in under 15 seconds.
        </p>
        <button id="landing-bottom-cta-btn" class="btn btn-primary btn-lg">
          ${ctaText}
        </button>
      </section>

    </div>
  `;

  // ── Start canvas mesh ──────────────────────────────────────
  const canvas = document.getElementById('hero-mesh-canvas');
  if (canvas) {
    _meshCleanup = createParticleMesh(canvas);
  }

  // ── Button listeners ──────────────────────────────────────
  const launchBtn = document.getElementById('landing-launch-btn');
  if (launchBtn) launchBtn.onclick = () => {
    if (window.__sbafaNavigate) {
      window.__sbafaNavigate(ctaRoute);
    } else {
      window.location.href = ctaRoute;
    }
  };

  const bottomCtaBtn = document.getElementById('landing-bottom-cta-btn');
  if (bottomCtaBtn) bottomCtaBtn.onclick = () => {
    if (window.__sbafaNavigate) {
      window.__sbafaNavigate(ctaRoute);
    } else {
      window.location.href = ctaRoute;
    }
  };

  const exploreArchBtn = document.getElementById('landing-explore-arch-btn');
  if (exploreArchBtn) {
    exploreArchBtn.onclick = () => {
      const archSec = document.getElementById('landing-arch-sec');
      if (archSec) archSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
}
