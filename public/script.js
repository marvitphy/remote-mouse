(function() {
  const touchpad = document.getElementById('touchpad');
  const status = document.getElementById('status');

  let ws = null;
  let lastPos = null;
  let touchStart = 0;
  let fingers = 0;
  let maxFingers = 0;
  let moved = 0;
  let pendingTap = null;
  let isDragging = false;
  let dragTimeout = null;
  let lastTapTime = 0;
  let isDoubleTapDrag = false;
  let precisionMode = false;
  let precisionTimeout = null;
  let initialPinchDist = null;
  let threeFingerStart = null;
  let gestureReady = false;
  let gestureReadyTimeout = null;
  let pinchMode = false;
  let pinchFrames = 0;

  const DRAG_DELAY = 400;
  const PRECISION_DELAY = 500;
  const SWIPE_THRESHOLD = 80;
  const GESTURE_SETTLE_DELAY = 40;
  const PINCH_THRESHOLD = 8;
  const PINCH_FRAMES_REQUIRED = 3;

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    ws.onopen = () => status.className = 'connected';
    ws.onclose = () => { status.className = ''; setTimeout(connect, 2000); };
    ws.onerror = () => status.className = '';
  }

  function send(data) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
  }

  function center(touches) {
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
  }

  function pinchDist(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function ripple(x, y, color) {
    const el = document.createElement('div');
    el.className = 'ripple';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    if (color) el.style.borderColor = color;
    touchpad.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function startPrecisionCheck() {
    precisionTimeout = setTimeout(() => {
      precisionMode = true;
      touchpad.classList.add('precision');
    }, PRECISION_DELAY);
  }

  function cancelPrecision() {
    clearTimeout(precisionTimeout);
    precisionMode = false;
    touchpad.classList.remove('precision');
  }

  touchpad.addEventListener('touchstart', function(e) {
    e.preventDefault();
    touchpad.classList.add('active');

    fingers = e.touches.length;
    if (fingers > maxFingers) maxFingers = fingers;
    touchStart = Date.now();
    moved = 0;
    lastPos = center(e.touches);

    clearTimeout(gestureReadyTimeout);
    gestureReadyTimeout = setTimeout(() => {
      gestureReady = true;
      if (fingers === 2) initialPinchDist = pinchDist(e.touches);
    }, GESTURE_SETTLE_DELAY);

    if (fingers >= 3) {
      clearTimeout(dragTimeout);
      cancelPrecision();
      if (!threeFingerStart) threeFingerStart = center(e.touches);
    } else if (fingers === 1 && maxFingers === 1) {
      const now = Date.now();
      const isQuickSecondTap = (now - lastTapTime) < 300;

      if (isQuickSecondTap && pendingTap) {
        clearTimeout(pendingTap);
        pendingTap = null;
        send({ type: 'doubleclick' });
        ripple(e.touches[0].clientX, e.touches[0].clientY, '#e74c3c');
        navigator.vibrate?.(10);
        isDoubleTapDrag = true;
        send({ type: 'mousedown', button: 'left' });
      } else {
        dragTimeout = setTimeout(() => {
          isDragging = true;
          send({ type: 'mousedown', button: 'left' });
          ripple(e.touches[0].clientX, e.touches[0].clientY, '#3498db');
          navigator.vibrate?.(20);
        }, DRAG_DELAY);
        startPrecisionCheck();
      }
    } else if (fingers === 2 && maxFingers === 2) {
      initialPinchDist = pinchDist(e.touches);
    }
  }, { passive: false });

  touchpad.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const pos = center(e.touches);

    if (e.touches.length > maxFingers) maxFingers = e.touches.length;

    if (lastPos) {
      const dx = pos.x - lastPos.x;
      const dy = pos.y - lastPos.y;
      moved += Math.abs(dx) + Math.abs(dy);

      if (moved > 10) {
        clearTimeout(dragTimeout);
        cancelPrecision();
        if (!isDragging) startPrecisionCheck();
      }

      if (!gestureReady) {
        // wait for fingers to settle
      } else if (maxFingers >= 3) {
        // 3 finger gesture - just track movement, don't send mouse events
      } else if (maxFingers === 2 || e.touches.length === 2) {
        if (e.touches.length === 2) {
          const dist = pinchDist(e.touches);
          if (initialPinchDist === null) initialPinchDist = dist;
          const delta = dist - initialPinchDist;

          if (pinchMode) {
            if (Math.abs(delta) > 5) {
              send({ type: 'zoom', delta: delta > 0 ? 1 : -1 });
              initialPinchDist = dist;
            }
          } else {
            if (Math.abs(delta) > PINCH_THRESHOLD) {
              pinchFrames++;
              if (pinchFrames >= PINCH_FRAMES_REQUIRED) {
                pinchMode = true;
                touchpad.classList.add('pinch');
              }
            } else {
              pinchFrames = 0;
            }
            send({ type: 'scroll', dy: -dy });
          }
        } else {
          send({ type: 'scroll', dy: -dy });
        }
      } else if (e.touches.length === 1 && maxFingers === 1) {
        send({ type: 'move', dx, dy, precision: precisionMode });
        if (isDoubleTapDrag && moved > 10) {
          clearTimeout(dragTimeout);
        }
      }
    }
    lastPos = pos;
  }, { passive: false });

  touchpad.addEventListener('touchend', function(e) {
    e.preventDefault();
    touchpad.classList.remove('active');
    clearTimeout(dragTimeout);
    cancelPrecision();

    const now = Date.now();
    const duration = now - touchStart;
    const tap = duration < 200 && moved < 15;

    if (isDragging || isDoubleTapDrag) {
      send({ type: 'mouseup', button: 'left' });
      if (isDragging) ripple(lastPos?.x || 0, lastPos?.y || 0, '#2ecc71');
      isDragging = false;
      isDoubleTapDrag = false;
    } else if (maxFingers >= 3 && threeFingerStart && e.touches.length === 0) {
      const endPos = lastPos || threeFingerStart;
      const dx = endPos.x - threeFingerStart.x;
      const dy = endPos.y - threeFingerStart.y;

      if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) {
          send({ type: 'shortcut', action: 'alttab' });
          ripple(endPos.x, endPos.y, '#9b59b6');
        } else {
          send({ type: 'shortcut', action: 'desktop' });
          ripple(endPos.x, endPos.y, '#9b59b6');
        }
        navigator.vibrate?.(30);
      } else if (Math.abs(dx) > SWIPE_THRESHOLD) {
        if (dx < 0) {
          send({ type: 'shortcut', action: 'prevdesktop' });
        } else {
          send({ type: 'shortcut', action: 'nextdesktop' });
        }
        ripple(endPos.x, endPos.y, '#9b59b6');
        navigator.vibrate?.(30);
      }
      threeFingerStart = null;
    } else if (tap && e.touches.length === 0) {
      if (fingers === 1) {
        const tapPos = { ...lastPos };
        lastTapTime = Date.now();
        pendingTap = setTimeout(() => {
          send({ type: 'click', button: 'left' });
          ripple(tapPos.x, tapPos.y);
          navigator.vibrate?.(10);
          pendingTap = null;
        }, 250);
      } else if (fingers === 2) {
        send({ type: 'click', button: 'right' });
        ripple(lastPos.x, lastPos.y, '#e67e22');
        navigator.vibrate?.(15);
      }
    }

    if (e.touches.length === 0) {
      lastPos = null;
      fingers = 0;
      maxFingers = 0;
      initialPinchDist = null;
      threeFingerStart = null;
      gestureReady = false;
      isDoubleTapDrag = false;
      pinchMode = false;
      pinchFrames = 0;
      touchpad.classList.remove('pinch');
      clearTimeout(gestureReadyTimeout);
    } else {
      fingers = e.touches.length;
      lastPos = center(e.touches);
      if (fingers === 2) initialPinchDist = pinchDist(e.touches);
    }
  }, { passive: false });

  touchpad.addEventListener('touchcancel', function() {
    touchpad.classList.remove('active');
    clearTimeout(dragTimeout);
    clearTimeout(gestureReadyTimeout);
    cancelPrecision();
    if (isDragging || isDoubleTapDrag) {
      send({ type: 'mouseup', button: 'left' });
      isDragging = false;
      isDoubleTapDrag = false;
    }
    lastPos = null;
    fingers = 0;
    maxFingers = 0;
    initialPinchDist = null;
    threeFingerStart = null;
    gestureReady = false;
    pinchMode = false;
    pinchFrames = 0;
    touchpad.classList.remove('pinch');
  });

  document.addEventListener('contextmenu', e => e.preventDefault());

  // Hide Safari address bar
  function hideAddressBar() {
    window.scrollTo(0, 1);
    document.body.scrollTop = 1;
  }

  // Try immediately and after load
  hideAddressBar();
  window.addEventListener('load', hideAddressBar);

  // Also hide on first touch (Safari requires user interaction)
  let addressBarHidden = false;
  document.addEventListener('touchstart', function hideOnTouch() {
    if (!addressBarHidden) {
      hideAddressBar();
      addressBarHidden = true;
    }
  }, { passive: true });

  connect();
})();
