(function () {
  'use strict';

  var PLAN_IMAGE_BASE = '/static/img/plan/';

  var PLAN_EXTERNAL_URL = {
    bathtub: PLAN_IMAGE_BASE + 'bathtub.png',
    bed: PLAN_IMAGE_BASE + 'bed.png',
    cabinet: PLAN_IMAGE_BASE + 'cabinet.png',
    chair: PLAN_IMAGE_BASE + 'chair.png',
    door: PLAN_IMAGE_BASE + 'door.png',
    lamp: PLAN_IMAGE_BASE + 'lamp.png',
    microwave: PLAN_IMAGE_BASE + 'microwave.png',
    sofa: PLAN_IMAGE_BASE + 'sofa.png',
    stove: PLAN_IMAGE_BASE + 'stove.png',
    table: PLAN_IMAGE_BASE + 'table.png',
    toilet: PLAN_IMAGE_BASE + 'toilet.png',
    window: PLAN_IMAGE_BASE + 'window.png',
  };

  function planRasterUrl(subtype) {
    var k = String(subtype || '').toLowerCase();
    var u = PLAN_EXTERNAL_URL[k];
    return typeof u === 'string' && u.length ? u : null;
  }

  function svgDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }

  function customSvg(hex) {
    const fill = hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#888888';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="14" y="18" width="72" height="64" rx="8" fill="' +
      fill +
      '" stroke="#263238" stroke-width="2.5"/>' +
      '<rect x="28" y="32" width="44" height="36" rx="4" fill="none" ' +
      'stroke="rgba(0,0,0,0.22)" stroke-width="2"/>' +
      '</svg>'
    );
  }

  const FURNITURE = {
    table:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="8" y="12" width="84" height="70" rx="4" fill="#c4a574" stroke="#5d4e37" stroke-width="2"/>' +
      '<circle cx="22" cy="78" r="5" fill="#6d5d45"/><circle cx="78" cy="78" r="5" fill="#6d5d45"/>' +
      '<circle cx="22" cy="22" r="5" fill="#6d5d45"/><circle cx="78" cy="22" r="5" fill="#6d5d45"/>' +
      '</svg>',
    chair:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="25" y="38" width="50" height="45" rx="3" fill="#8d6e63" stroke="#4e342e" stroke-width="2"/>' +
      '<rect x="25" y="17" width="50" height="22" rx="2" fill="#6d4c41" stroke="#3e2723" stroke-width="1.5"/>' +
      '</svg>',
    sofa:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="10" y="30" width="80" height="52" rx="6" fill="#5c6bc0" stroke="#3949ab" stroke-width="2"/>' +
      '<rect x="10" y="10" width="80" height="24" rx="5" fill="#3949ab" stroke="#283593" stroke-width="2"/>' +
      '</svg>',
    cabinet:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="10" y="8" width="80" height="84" rx="2" fill="#8d6e63" stroke="#4e342e" stroke-width="2"/>' +
      '<line x1="50" y1="12" x2="50" y2="88" stroke="#3e2723" stroke-width="2"/>' +
      '<circle cx="42" cy="50" r="2.5" fill="#333"/><circle cx="58" cy="50" r="2.5" fill="#333"/>' +
      '</svg>',
    bed:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="12" y="25" width="76" height="58" rx="4" fill="#e57373" stroke="#c62828" stroke-width="2"/>' +
      '<rect x="12" y="25" width="24" height="58" rx="3" fill="#ffab91" stroke="#d84315" stroke-width="1.5"/>' +
      '</svg>',
    toilet:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="52" y="14" width="34" height="40" rx="3" fill="#eceff1" stroke="#78909c" stroke-width="2"/>' +
      '<ellipse cx="36" cy="62" rx="28" ry="22" fill="#fafafa" stroke="#607d8b" stroke-width="2"/>' +
      '<ellipse cx="36" cy="58" rx="14" ry="10" fill="#b0bec5"/>' +
      '</svg>',
    bathtub:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="6" y="24" width="88" height="52" rx="16" fill="#90caf9" stroke="#1565c0" stroke-width="2.5"/>' +
      '<rect x="14" y="32" width="72" height="36" rx="12" fill="#64b5f6" opacity="0.75"/>' +
      '</svg>',
    microwave:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="10" y="15" width="80" height="70" rx="3" fill="#616161" stroke="#212121" stroke-width="2"/>' +
      '<rect x="18" y="22" width="50" height="56" rx="2" fill="#263238" stroke="#37474f"/>' +
      '<circle cx="78" cy="48" r="7" fill="#424242" stroke="#757575" stroke-width="1.5"/>' +
      '</svg>',
    stove:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="8" y="10" width="84" height="80" rx="4" fill="#37474f" stroke="#212121" stroke-width="2"/>' +
      '<circle cx="32" cy="35" r="12" fill="#212121" stroke="#546e7a" stroke-width="2"/>' +
      '<circle cx="68" cy="35" r="12" fill="#212121" stroke="#546e7a" stroke-width="2"/>' +
      '<circle cx="32" cy="68" r="12" fill="#212121" stroke="#546e7a" stroke-width="2"/>' +
      '<circle cx="68" cy="68" r="12" fill="#212121" stroke="#546e7a" stroke-width="2"/>' +
      '</svg>',
    lamp:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<ellipse cx="50" cy="36" rx="32" ry="22" fill="#fff9c4" stroke="#fbc02d" stroke-width="2"/>' +
      '<rect x="44" y="53" width="12" height="28" fill="#8d6e63" stroke="#5d4037" stroke-width="1.5"/>' +
      '<ellipse cx="50" cy="90" rx="22" ry="7" fill="#a1887f" stroke="#6d4c41" stroke-width="1.5"/>' +
      '</svg>',
  };

  const OPENING = {
    door:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="8" y="8" width="84" height="84" rx="2" fill="#6d4c41" stroke="#3e2723" stroke-width="2"/>' +
      '<rect x="14" y="14" width="72" height="72" rx="1" fill="#8d6e63" opacity="0.5"/>' +
      '<circle cx="74" cy="50" r="4" fill="#ffd54f" stroke="#f9a825" stroke-width="1"/>' +
      '</svg>',
    window:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect x="8" y="12" width="84" height="76" rx="2" fill="#b3e5fc" stroke="#0277bd" stroke-width="2"/>' +
      '<line x1="50" y1="14" x2="50" y2="86" stroke="#0277bd" stroke-width="2"/>' +
      '<line x1="10" y1="50" x2="90" y2="50" stroke="#0277bd" stroke-width="2"/>' +
      '</svg>',
  };

  function furnitureUrl(subtype, color, customImageUrl) {
    var key = String(subtype || '').toLowerCase();
    var raster = planRasterUrl(key);
    if (raster) return raster;
    if (key === 'custom') {
      var cu = customImageUrl && String(customImageUrl).trim();
      if (cu) return cu;
      return svgDataUrl(customSvg(color));
    }
    var svg = FURNITURE[key] || FURNITURE.table;
    return svgDataUrl(svg);
  }

  function getDataUrl(obj) {
    if (!obj || obj.type === 'wall') return null;
    if (obj.type === 'opening') {
      var st = String(obj.subtype || '').toLowerCase();
      var openingRaster = planRasterUrl(st);
      if (openingRaster) return openingRaster;
      var svg = OPENING[st] || OPENING.door;
      return svgDataUrl(svg);
    }
    if (obj.type === 'furniture') {
      return furnitureUrl(obj.subtype, obj.color, obj.customImageUrl);
    }
    return null;
  }

  function styleCanvasElement(el, obj, options) {
    const opts = options || {};
    if (!obj || obj.type === 'wall') return;
    const url = getDataUrl(obj);
    if (!url) {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = obj.color || '#ddd';
      return;
    }
    el.style.backgroundImage = 'url("' + url + '")';
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.backgroundColor = opts.preview ? 'rgba(241,245,249,0.88)' : '#f1f5f9';
  }

  function styleSidebarThumb(el, item) {
    if (!item) return;
    if (item.type === 'wall') {
      el.style.backgroundImage = 'none';
      el.style.backgroundSize = '';
      el.style.backgroundRepeat = '';
      el.style.backgroundPosition = '';
      el.style.backgroundColor = item.color || '#4f4f4f';
      return;
    }
    const pseudo = {
      type: item.type,
      subtype: item.subtype,
      color: item.color,
      customImageUrl: item.customImageUrl,
    };
    const url = getDataUrl(pseudo);
    if (url) {
      el.style.backgroundImage = 'url("' + url + '")';
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = '#e8ecf1';
    } else {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = item.color || '#ccc';
    }
  }

  function styleDragGhost(el, item) {
    if (!item || item.type === 'wall') return;
    const pseudo = {
      type: item.type,
      subtype: item.subtype,
      color: item.color,
      customImageUrl: item.customImageUrl,
    };
    styleCanvasElement(el, pseudo, { preview: true });
  }

  window.FurniturePlannerSprites = {
    getDataUrl: getDataUrl,
    styleCanvasElement: styleCanvasElement,
    styleSidebarThumb: styleSidebarThumb,
    styleDragGhost: styleDragGhost,
  };
})();
