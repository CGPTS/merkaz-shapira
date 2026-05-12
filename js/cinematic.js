/* ============================================
   cinematic.js — Three.js + GSAP ScrollTrigger
   חוויה קולנועית תלת-ממדית — מרכז שפירא
   ============================================ */
(function () {
  'use strict';


  /* ══════════════════════════════════════════
   * Three.js — מערכת פרטיקלים זהובים
   * ══════════════════════════════════════════ */
  function initParticles() {
    var canvas = document.getElementById('particle-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    var W = function () { return window.innerWidth; };
    var H = function () { return window.innerHeight; };

    /* Renderer */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W(), H());

    /* Scene + Camera */
    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(58, W() / H(), 0.1, 100);
    camera.position.z = 8;

    /* ── יצירת הפרטיקלים ── */
    var COUNT = 320;
    var pos = new Float32Array(COUNT * 3);
    var col = new Float32Array(COUNT * 3);
    var vel = new Float32Array(COUNT);   // מהירות עלייה לכל פרטיקל
    var siz = new Float32Array(COUNT);   // גודל שונה לכל פרטיקל

    for (var i = 0; i < COUNT; i++) {
      // מיקום רנדומלי בחלל
      pos[i*3]   = (Math.random() - 0.5) * 22;   // x
      pos[i*3+1] = (Math.random() - 0.5) * 15;   // y
      pos[i*3+2] = (Math.random() - 0.5) * 7;    // z (עומק)

      // מהירות עלייה
      vel[i] = 0.004 + Math.random() * 0.010;

      // גודל רנדומלי
      siz[i] = 0.03 + Math.random() * 0.06;

      // ספקטרום זהב → שמפניה → לבן
      var t     = Math.random();
      col[i*3]   = 0.76 + t * 0.24;  // R
      col[i*3+1] = 0.48 + t * 0.42;  // G
      col[i*3+2] = 0.06 + t * 0.16;  // B
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    var mat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    var points = new THREE.Points(geo, mat);
    scene.add(points);

    /* ── אור אמביינט עדין לתאורה ── */
    var ambientLight = new THREE.AmbientLight(0xc9a84c, 0.3);
    scene.add(ambientLight);

    /* ── Parallax על עכבר ── */
    var mx = 0, my = 0;
    window.addEventListener('mousemove', function (e) {
      mx = (e.clientX / W() - 0.5) * 2;
      my = (e.clientY / H() - 0.5) * 2;
    }, { passive: true });

    /* ── לולאת אנימציה ── */
    var rafId = null;
    var posArr = geo.attributes.position.array;

    function tick() {
      rafId = requestAnimationFrame(tick);

      // הזזת פרטיקלים כלפי מעלה, מחזור כשיוצאים מהמסך
      for (var j = 0; j < COUNT; j++) {
        posArr[j*3+1] += vel[j];
        if (posArr[j*3+1] > 9) {
          posArr[j*3+1] = -9;
          posArr[j*3]   = (Math.random() - 0.5) * 22; // x רנדומלי חדש
        }
      }
      geo.attributes.position.needsUpdate = true;

      // תנועת מצלמה עדינה אחרי העכבר
      camera.position.x += (mx * 0.28 - camera.position.x) * 0.042;
      camera.position.y += (-my * 0.20 - camera.position.y) * 0.042;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    }

    tick();

    /* ── עצירה כשה-Hero לא גלוי (חיסכון CPU) ── */
    var heroEl = document.getElementById('hero-section');
    if (heroEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          if (!rafId) tick();
        } else {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }, { threshold: 0 }).observe(heroEl);
    }

    /* ── Resize ── */
    window.addEventListener('resize', function () {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    }, { passive: true });
  }


  /* ══════════════════════════════════════════
   * GSAP — אנימציית כניסה + ScrollTrigger Parallax
   * ══════════════════════════════════════════ */
  function initHeroAnimation() {
    if (typeof gsap === 'undefined') return;

    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    /* ── אנימציית כניסה (פעם אחת) ── */
    var tl = gsap.timeline({ delay: 0.25 });
    tl
      .from('.hero-logo', {
        opacity: 0, y: -38, scale: 0.72,
        duration: 1.15, ease: 'power3.out'
      })
      .from('.hero-eyebrow', {
        opacity: 0, y: 16, letterSpacing: '0.6em',
        duration: 0.75, ease: 'power2.out'
      }, '-=0.55')
      .from('.hero-title', {
        opacity: 0, y: 30,
        duration: 0.95, ease: 'power3.out'
      }, '-=0.40')
      .from('.hero-subtitle', {
        opacity: 0, y: 20,
        duration: 0.75, ease: 'power2.out'
      }, '-=0.35')
      .from('.hero-desc', {
        opacity: 0, y: 14,
        duration: 0.65, ease: 'power2.out'
      }, '-=0.28')
      .from('.hero-cta', {
        opacity: 0, scale: 0.60,
        duration: 0.58, ease: 'back.out(2.4)'
      }, '-=0.18')
      .from('.scroll-hint', {
        opacity: 0, y: 8,
        duration: 0.5, ease: 'power1.out'
      }, '-=0.10');

    /* ── ScrollTrigger Parallax ── */
    if (typeof ScrollTrigger === 'undefined') return;

    // תמונת רקע מתמשכת קדימה (zoom-in)
    gsap.to('.hero-bg-img', {
      scale: 1.25,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.4,
      },
    });

    // תוכן Hero — מתרחק ונעלם בגלילה
    gsap.to('.hero-content', {
      yPercent: -38,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: '58% top',
        scrub: 1.1,
      },
    });

    // Canvas פרטיקלים — נע לאט יותר (עומק)
    gsap.to('#particle-canvas', {
      yPercent: 20,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    // Wizard wrapper — fade-in כשמגיעים אליו
    gsap.from('#wizard-wrapper', {
      opacity: 0,
      y: 55,
      duration: 0.95,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '#wizard-wrapper',
        start: 'top 87%',
        toggleActions: 'play none none reverse',
      },
    });
  }


  /* ══════════════════════════════════════════
   * Patch showStep — מעברים קולנועיים בין שלבי האשף
   * ══════════════════════════════════════════ */
  function patchStepTransitions() {
    if (typeof gsap === 'undefined') return;

    // ממתין ל-app.js להגדיר את showStep
    var origShowStep = window.showStep;
    if (typeof origShowStep !== 'function') {
      // ניסיון נוסף קצר אחרי 100ms
      setTimeout(patchStepTransitions, 100);
      return;
    }

    window.showStep = function (step) {
      var currentEl = document.querySelector('.step.active');
      var nextEl    = document.getElementById('step' + step);

      // Fallback אם אין אנימציה אפשרית
      if (!currentEl || !nextEl || currentEl === nextEl) {
        document.querySelectorAll('.step').forEach(function (s) {
          s.classList.remove('active');
        });
        if (nextEl) nextEl.classList.add('active');
        _scrollToWizard();
        return;
      }

      var currentNum   = parseInt(currentEl.id.replace('step', ''), 10);
      var goingForward = step > currentNum;
      var xOut = goingForward ? -60 : 60;
      var xIn  = goingForward ?  60 : -60;

      // עצירת tweens קודמים
      gsap.killTweensOf([currentEl, nextEl]);

      /* ── יציאה של השלב הנוכחי ── */
      gsap.to(currentEl, {
        opacity: 0,
        x: xOut,
        scale: 0.93,
        duration: 0.32,
        ease: 'power2.in',
        onComplete: function () {
          // ביטול השלב הנוכחי
          currentEl.classList.remove('active');
          gsap.set(currentEl, { clearProps: 'all' });

          // הגדרת מצב התחלתי לשלב הבא לפני הצגתו
          nextEl.style.opacity   = '0';
          nextEl.style.transform = 'translateX(' + xIn + 'px) scale(0.93)';

          // הפעלת השלב הבא (display: block)
          nextEl.classList.add('active');

          /* ── כניסה של השלב החדש ── */
          gsap.to(nextEl, {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.44,
            ease: 'power2.out',
            onComplete: function () {
              gsap.set(nextEl, { clearProps: 'all' });
            },
          });

          _scrollToWizard();
        },
      });
    };
  }

  /* גלילה חלקה לאזור האשף */
  function _scrollToWizard() {
    var w = document.getElementById('wizard-wrapper');
    if (!w) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var top = w.getBoundingClientRect().top + window.scrollY - 14;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }


  /* ══════════════════════════════════════════
   * כפתור CTA — גלילה לאשף
   * ══════════════════════════════════════════ */
  function initCTA() {
    var btn = document.getElementById('hero-start-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var w = document.getElementById('wizard-wrapper');
      if (w) {
        w.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }


  /* ══════════════════════════════════════════
   * Boot
   * ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    initParticles();
    initHeroAnimation();
    patchStepTransitions();
    initCTA();
  });

})();
