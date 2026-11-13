/**
 * Photo Calendar Studio PWA
 * 24MP Export & Precision Calendar Stamp Engine
 */

// 添付 rogo.af / 構図.jpg からトレースした「Tc」カリグラフィーモノグラムSVGパス
const DEFAULT_TC_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 155">
  <g fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round">
    <!-- Tの上部横バー（優美な波形ストローク） -->
    <path d="M 38 34 C 68 10, 125 48, 212 32" stroke-width="6.5" />
    <path d="M 38 34 C 24 44, 38 58, 54 48" stroke-width="5.0" />
    <!-- Tのメイン縦ステム〜下部カール -->
    <path d="M 134 29 C 116 68, 102 108, 76 132 C 58 148, 30 140, 34 118 C 37 102, 56 104, 60 116" stroke-width="8.5" />
    <!-- cのループとクロスストローク -->
    <path d="M 192 78 C 204 62, 180 52, 158 68 C 134 86, 128 124, 158 134 C 186 142, 218 118, 228 96" stroke-width="7.5" />
    <!-- Tからcへ繋がる繊細なヘアライン -->
    <path d="M 68 92 C 105 72, 155 62, 212 40" stroke-width="3.2" opacity="0.9" />
  </g>
</svg>`;

const TARGET_MEGAPIXELS = 24000000; // 24MP (24,000,000 pixels)
const PREVIEW_MAX_SIDE = 1600;      // プレビュー用軽量サイズ

const state = {
  image: null,
  originalDate: new Date(),
  selectedDate: new Date(),
  showTime: true,

  // レイアウト・配置
  stampTarget: 'photo', // 'photo' | 'canvas'
  calPos: 'bottom-left', // 'bottom-left' | 'bottom-right'
  calScale: 1.0,
  calMarginX: 6.5,
  calMarginY: 6.0,
  logoScale: 1.0,
  logoMarginY: 4.2,

  // 枠・比率
  canvasRatio: 'original',
  photoRatio: 'original',
  cropOffsetX: 0,
  cropOffsetY: 0,
  frameMode: 'none', // 'none' | 'solid' | 'blur'
  frameThickness: 6.0,
  frameColor: '#FFFFFF',
  blurAmount: 40,
  blurBrightness: 85,
  innerBorder: false,
  photoShadow: true,

  // カラー・ロゴ
  textColor: '#FFFFFF',
  logoColor: '#FFFFFF',
  ringColor: '#DBE734',
  weekendMode: 'mono', // 'mono' | 'color'
  sunColor: '#FF5252',
  satColor: '#448AFF',
  showLogo: true,
  logoSubText: '@Tsukaccha',
  customLogoImg: null,
  defaultLogoImg: null
};

// DOM要素の参照
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const exportBtn = document.getElementById('exportBtn');
const exifStatus = document.getElementById('exifStatus');
const resStatus = document.getElementById('resStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

// 初期化
window.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initControls();
  await loadDefaultLogo();
  await document.fonts.ready;

  // 初期状態の日時をセット
  updateDateInputUI(state.selectedDate);
  updateUIlaVisibility();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// デフォルトSVGロゴのImage化
function loadDefaultLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([DEFAULT_TC_LOGO_SVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      state.defaultLogoImg = img;
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

// タブ切り替え
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

// 各種UIイベントのバインド
function initControls() {
  // 画像読み込み
  document.getElementById('imageLoader').addEventListener('change', handleImageUpload);
  exportBtn.addEventListener('click', export24MPImage);

  // 日時操作
  const dateInput = document.getElementById('dateInput');
  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.selectedDate = new Date(e.target.value);
      requestPreviewRender();
    }
  });

  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDay(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDay(1));
  document.getElementById('resetExifBtn').addEventListener('click', () => {
    state.selectedDate = new Date(state.originalDate);
    updateDateInputUI(state.selectedDate);
    requestPreviewRender();
  });

  document.getElementById('showTimeToggle').addEventListener('change', (e) => {
    state.showTime = e.target.checked;
    requestPreviewRender();
  });

  // ラジオボタン群
  bindRadio('stampTarget', val => state.stampTarget = val);
  bindRadio('calPos', val => state.calPos = val);
  bindRadio('frameMode', val => {
    state.frameMode = val;
    updateUIlaVisibility();
  });
  bindRadio('weekendMode', val => {
    state.weekendMode = val;
    updateUIlaVisibility();
  });

  // スライダー群
  bindSlider('calScale', val => {
    state.calScale = val / 100;
    document.getElementById('calScaleVal').textContent = `${val}%`;
  });
  bindSlider('calMarginX', val => {
    state.calMarginX = parseFloat(val);
    updateMarginLabel();
  });
  bindSlider('calMarginY', val => {
    state.calMarginY = parseFloat(val);
    updateMarginLabel();
  });
  bindSlider('logoScale', val => {
    state.logoScale = val / 100;
    document.getElementById('logoScaleVal').textContent = `${val}%`;
  });
  bindSlider('logoMarginY', val => {
    state.logoMarginY = parseFloat(val);
    document.getElementById('logoMarginYVal').textContent = `${val}%`;
  });
  bindSlider('frameThickness', val => {
    state.frameThickness = parseFloat(val);
    document.getElementById('frameThicknessVal').textContent = `${val}%`;
  });
  bindSlider('blurAmount', val => {
    state.blurAmount = parseInt(val, 10);
    document.getElementById('blurAmountVal').textContent = `${val}px`;
  });
  bindSlider('blurBrightness', val => {
    state.blurBrightness = parseInt(val, 10);
    document.getElementById('blurBrightnessVal').textContent = `${val}%`;
  });
  bindSlider('cropOffsetX', val => state.cropOffsetX = parseInt(val, 10));
  bindSlider('cropOffsetY', val => state.cropOffsetY = parseInt(val, 10));

  document.getElementById('resetCropBtn').addEventListener('click', () => {
    state.cropOffsetX = 0;
    state.cropOffsetY = 0;
    document.getElementById('cropOffsetX').value = 0;
    document.getElementById('cropOffsetY').value = 0;
    requestPreviewRender();
  });

  // トグルスイッチ
  document.getElementById('innerBorderToggle').addEventListener('change', e => {
    state.innerBorder = e.target.checked;
    requestPreviewRender();
  });
  document.getElementById('photoShadowToggle').addEventListener('change', e => {
    state.photoShadow = e.target.checked;
    requestPreviewRender();
  });
  document.getElementById('showLogoToggle').addEventListener('change', e => {
    state.showLogo = e.target.checked;
    requestPreviewRender();
  });

  // 比率ボタン（キャンバス全体）
  initRatioButtons('canvasRatioGroup', ratio => {
    state.canvasRatio = ratio;
  });

  // 比率ボタン（中の写真）
  initRatioButtons('photoRatioGroup', ratio => {
    state.photoRatio = ratio;
  });

  // カラーピッカー＆プリセット
  bindColor('frameColor', val => state.frameColor = val);
  bindColor('textColor', val => state.textColor = val);
  bindColor('logoColor', val => state.logoColor = val);
  bindColor('ringColor', val => state.ringColor = val);
  bindColor('sunColor', val => state.sunColor = val);
  bindColor('satColor', val => state.satColor = val);

  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const color = btn.dataset.color;
      const input = document.getElementById(targetId);
      input.value = color;
      input.dispatchEvent(new Event('input'));
    });
  });

  // ロゴテキスト・カスタムロゴ読み込み
  document.getElementById('logoSubText').addEventListener('input', e => {
    state.logoSubText = e.target.value;
    requestPreviewRender();
  });

  document.getElementById('customLogoLoader').addEventListener('change', handleCustomLogoUpload);
  document.getElementById('resetLogoBtn').addEventListener('click', () => {
    state.customLogoImg = null;
    localStorage.removeItem('savedCustomLogo');
    requestPreviewRender();
  });

  // 保存済みカスタムロゴの復元
  const savedLogo = localStorage.getItem('savedCustomLogo');
  if (savedLogo) {
    const img = new Image();
    img.onload = () => {
      state.customLogoImg = img;
      requestPreviewRender();
    };
    img.src = savedLogo;
  }
}

function bindRadio(name, callback) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        callback(e.target.value);
        requestPreviewRender();
      }
    });
  });
}

function bindSlider(id, callback) {
  const el = document.getElementById(id);
  el.addEventListener('input', e => {
    callback(e.target.value);
    requestPreviewRender();
  });
}

function bindColor(id, callback) {
  const el = document.getElementById(id);
  el.addEventListener('input', e => {
    callback(e.target.value);
    requestPreviewRender();
  });
}

function initRatioButtons(groupId, callback) {
  const container = document.getElementById(groupId);
  const btns = container.querySelectorAll('.ratio-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callback(btn.dataset.ratio);
      requestPreviewRender();
    });
  });
}

function updateMarginLabel() {
  document.getElementById('calMarginVal').textContent = `${state.calMarginX}% / ${state.calMarginY}%`;
}

function updateUIlaVisibility() {
  document.getElementById('solidFrameOptions').style.display = state.frameMode === 'solid' ? 'block' : 'none';
  document.getElementById('blurFrameOptions').style.display = state.frameMode === 'blur' ? 'block' : 'none';
  document.getElementById('weekendColorOptions').style.display = state.weekendMode === 'color' ? 'block' : 'none';
}

function shiftDay(delta) {
  const d = new Date(state.selectedDate);
  d.setDate(d.getDate() + delta);
  state.selectedDate = d;
  updateDateInputUI(d);
  requestPreviewRender();
}

function updateDateInputUI(date) {
  const pad = n => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  document.getElementById('dateInput').value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// 写真アップロード＆Exif解析
async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Exif抽出
  let exifDate = null;
  try {
    if (window.exifr) {
      const data = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
      if (data) {
        exifDate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
      }
    }
  } catch (err) {
    console.warn('Exif parse warning:', err);
  }

  if (exifDate instanceof Date && !isNaN(exifDate)) {
    state.originalDate = new Date(exifDate);
    state.selectedDate = new Date(exifDate);
    exifStatus.textContent = `Exif日時取得済: ${exifDate.toLocaleString('ja-JP')}`;
  } else {
    const fallback = file.lastModified ? new Date(file.lastModified) : new Date();
    state.originalDate = fallback;
    state.selectedDate = new Date(fallback);
    exifStatus.textContent = `Exifなし (ファイル日時を使用)`;
  }
  updateDateInputUI(state.selectedDate);

  // 画像ロード
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    emptyState.style.display = 'none';
    exportBtn.disabled = false;
    requestPreviewRender();
  };
  img.src = url;
}

// カスタムロゴ読み込み
function handleCustomLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const img = new Image();
    img.onload = () => {
      state.customLogoImg = img;
      try { localStorage.setItem('savedCustomLogo', dataUrl); } catch (_) {}
      requestPreviewRender();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// アスペクト比文字列から数値 (W/H) を返す
function parseAspectRatio(ratioStr, fallbackWidth, fallbackHeight) {
  if (!ratioStr || ratioStr === 'original') {
    return fallbackWidth / fallbackHeight;
  }
  const [w, h] = ratioStr.split(':').map(Number);
  return w / h;
}

// 24MPのピクセル寸法を算出
function calculate24MPDimensions(aspectRatio) {
  const height = Math.round(Math.sqrt(TARGET_MEGAPIXELS / aspectRatio));
  const width = Math.round(height * aspectRatio);
  return { width, height };
}

let renderQueued = false;
function requestPreviewRender() {
  if (!state.image) return;
  if (!renderQueued) {
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const aspect = parseAspectRatio(state.canvasRatio, state.image.width, state.image.height);
      const fullDim = calculate24MPDimensions(aspect);
      resStatus.textContent = `出力: ${fullDim.width} × ${fullDim.height} px (${((fullDim.width * fullDim.height) / 1e6).toFixed(1)}MP)`;

      // プレビューサイズ算出
      let pw, ph;
      if (aspect >= 1) {
        pw = PREVIEW_MAX_SIDE;
        ph = Math.round(PREVIEW_MAX_SIDE / aspect);
      } else {
        ph = PREVIEW_MAX_SIDE;
        pw = Math.round(PREVIEW_MAX_SIDE * aspect);
      }
      previewCanvas.width = pw;
      previewCanvas.height = ph;
      renderComposition(previewCtx, pw, ph);
    });
  }
}

/**
 * メイン描画エンジン（プレビューと24MP出力で完全共通の比率計算）
 */
function renderComposition(ctx, canvasW, canvasH) {
  const img = state.image;
  if (!img) return;

  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  const shortSide = Math.min(canvasW, canvasH);

  // 1. 背景＆フレーム描画と内側写真領域 (photoRect) の算出
  let photoRect = { x: 0, y: 0, w: canvasW, h: canvasH };

  if (state.frameMode === 'none') {
    // 枠なし時はキャンバス全体が写真エリア
    drawCroppedPhoto(ctx, img, photoRect, canvasW / canvasH);
  } else {
    // 背景描画（単色 or ぼかし）
    if (state.frameMode === 'solid') {
      ctx.fillStyle = state.frameColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (state.frameMode === 'blur') {
      drawBlurredBackground(ctx, img, canvasW, canvasH, shortSide);
    }

    // 余白を除いた利用可能領域に、選択された photoRatio の枠を最大化して配置
    const pad = shortSide * (state.frameThickness / 100);
    const availW = Math.max(10, canvasW - pad * 2);
    const availH = Math.max(10, canvasH - pad * 2);
    const targetPhotoAspect = parseAspectRatio(state.photoRatio, img.width, img.height);

    let pw = availW;
    let ph = pw / targetPhotoAspect;
    if (ph > availH) {
      ph = availH;
      pw = ph * targetPhotoAspect;
    }

    photoRect = {
      x: (canvasW - pw) / 2,
      y: (canvasH - ph) / 2,
      w: pw,
      h: ph
    };

    // ドロップシャドウ
    if (state.photoShadow && state.frameThickness > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
      ctx.shadowBlur = shortSide * 0.022;
      ctx.shadowOffsetY = shortSide * 0.006;
      ctx.fillStyle = '#000';
      ctx.fillRect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
      ctx.restore();
    }

    // 内側写真の描画
    drawCroppedPhoto(ctx, img, photoRect, targetPhotoAspect);

    // ぼかし背景時の細い白内枠オプション
    if (state.frameMode === 'blur' && state.innerBorder) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(2, shortSide * 0.0025);
      ctx.strokeRect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
      ctx.restore();
    }
  }

  // 2. スタンプの基準矩形（写真内側 or キャンバス全体）
  const targetRect = (state.stampTarget === 'photo' && state.frameMode !== 'none')
    ? photoRect
    : { x: 0, y: 0, w: canvasW, h: canvasH };

  // 3. 上部ロゴ＆水平ライン描画
  if (state.showLogo) {
    drawTopLogoOverlay(ctx, targetRect);
  }

  // 4. カレンダー＆時刻スタンプ描画
  drawCalendarOverlay(ctx, targetRect);

  ctx.restore();
}

// 写真を指定領域にトリミングして描画
function drawCroppedPhoto(ctx, img, destRect, targetAspect) {
  const imgAspect = img.width / img.height;
  let sw, sh;
  if (imgAspect > targetAspect) {
    sh = img.height;
    sw = sh * targetAspect;
  } else {
    sw = img.width;
    sh = sw / targetAspect;
  }

  const maxOffsetX = (img.width - sw) / 2;
  const maxOffsetY = (img.height - sh) / 2;
  const sx = maxOffsetX + (state.cropOffsetX / 100) * maxOffsetX;
  const sy = maxOffsetY + (state.cropOffsetY / 100) * maxOffsetY;

  ctx.drawImage(img, sx, sy, sw, sh, destRect.x, destRect.y, destRect.w, destRect.h);
}

// ぼかし背景の描画（高解像度でも均一にぼかすためオフスクリーン縮小併用）
function drawBlurredBackground(ctx, img, canvasW, canvasH, shortSide) {
  const blurScale = Math.max(canvasW, canvasH) / PREVIEW_MAX_SIDE;
  const effectiveBlur = state.blurAmount * blurScale;

  ctx.save();
  ctx.filter = `blur(${effectiveBlur}px) brightness(${state.blurBrightness}%)`;

  // 端の透過を防ぐため12%拡大してカバー描画
  const expand = 0.12;
  const destRect = {
    x: -canvasW * expand,
    y: -canvasH * expand,
    w: canvasW * (1 + expand * 2),
    h: canvasH * (1 + expand * 2)
  };
  drawCroppedPhoto(ctx, img, destRect, canvasW / canvasH);
  ctx.restore();
}

/**
 * 上部ロゴ（Tcモノグラム ＋ @Tsukaccha ＋ 左右の水平ライン）の描画
 * 構図.jpg のバランスを忠実に再現
 */
function drawTopLogoOverlay(ctx, rect) {
  const baseUnit = Math.min(rect.w, rect.h);
  const scale = state.logoScale;

  const centerX = rect.x + rect.w / 2;
  const topY = rect.y + rect.h * (state.logoMarginY / 100);

  // ロゴサイズ計算 (構図.jpg準拠)
  const logoH = baseUnit * 0.048 * scale;
  const activeLogo = state.customLogoImg || state.defaultLogoImg;
  const logoAspect = activeLogo ? (activeLogo.width / activeLogo.height) : (260 / 155);
  const logoW = logoH * logoAspect;

  ctx.save();

  // ロゴを指定色で着色して描画するためオフスクリーンCanvasを使用
  if (activeLogo) {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(logoW));
    off.height = Math.max(1, Math.round(logoH));
    const offCtx = off.getContext('2d');

    offCtx.drawImage(activeLogo, 0, 0, off.width, off.height);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.fillStyle = state.logoColor;
    offCtx.fillRect(0, 0, off.width, off.height);

    ctx.drawImage(off, centerX - logoW / 2, topY, logoW, logoH);
  }

  // @Tsukaccha サブテキスト描画
  const subFontSize = baseUnit * 0.0145 * scale;
  ctx.font = `${subFontSize}px "Nova Flat", sans-serif`;
  ctx.fillStyle = state.logoColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const subTextY = topY + logoH * 0.94;
  if (state.logoSubText) {
    ctx.fillText(state.logoSubText, centerX, subTextY);
  }

  // 左右の水平装飾ライン (構図.jpgの通りロゴ中央付近の高さに左右対称配置)
  const lineY = topY + logoH * 0.56;
  const innerGap = Math.max(logoW * 0.72, baseUnit * 0.048 * scale);
  const lineLength = rect.w * 0.145 * scale;

  ctx.strokeStyle = state.logoColor;
  ctx.lineWidth = Math.max(1.5, baseUnit * 0.0014 * scale);
  ctx.beginPath();
  // 左ライン
  ctx.moveTo(centerX - innerGap - lineLength, lineY);
  ctx.lineTo(centerX - innerGap, lineY);
  // 右ライン
  ctx.moveTo(centerX + innerGap, lineY);
  ctx.lineTo(centerX + innerGap + lineLength, lineY);
  ctx.stroke();

  ctx.restore();
}

/**
 * カレンダー＆日時スタンプ描画（構図.jpg 完全再現 ＋ 1文字単位の等間隔グリッド配置）
 */
function drawCalendarOverlay(ctx, rect) {
  const baseUnit = Math.min(rect.w, rect.h);
  const scale = state.calScale;

  // カレンダーブロック全体の幅 (構図.jpg比率: 短辺の約37.2%)
  const calW = baseUnit * 0.372 * scale;
  const colStep = calW / 6; // 7列（インデックス0〜6）の列間隔

  // 6週間になる月でも見切れないよう行数を事前計算
  const gridData = generateCalendarGrid(state.selectedDate);
  const rowCount = gridData.length / 7;

  // 各パーツの寸法
  const monthFontSize = calW * 0.142;
  const timeFontSize = calW * 0.062;
  const stripeTopGap = calW * 0.055;
  const stripeH = calW * 0.033;
  const gridTopGap = calW * 0.095;
  const rowStep = calW * 0.122;
  const dateFontSize = calW * 0.052;

  const totalCalH = monthFontSize + stripeTopGap + stripeH + gridTopGap + (rowCount - 1) * rowStep + dateFontSize;

  // カレンダー左上の基準座標 (startX, startY)
  const marginX = rect.w * (state.calMarginX / 100);
  const marginY = rect.h * (state.calMarginY / 100);

  const startX = state.calPos === 'bottom-left'
    ? rect.x + marginX
    : rect.x + rect.w - marginX - calW;
  const startY = rect.y + rect.h - marginY - totalCalH;

  ctx.save();

  // 1. 月名 (October 等) ＆ 時刻 (PM 10:56 等)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthStr = monthNames[state.selectedDate.getMonth()];
  const headerBaselineY = startY + monthFontSize * 0.85;

  // 月名（第0列の左端から少し内側＝数字列の左端に揃える）
  const colHalfWidth = dateFontSize * 0.62;
  const leftAlignX = startX - colHalfWidth;
  const rightAlignX = startX + calW + colHalfWidth;

  ctx.fillStyle = state.textColor;
  ctx.font = `${monthFontSize}px "Nova Flat", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(monthStr, leftAlignX, headerBaselineY);

  // 時刻 (PM 10:56)
  if (state.showTime) {
    const hours24 = state.selectedDate.getHours();
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const mins = String(state.selectedDate.getMinutes()).padStart(2, '0');
    const timeStr = `${ampm} ${hours12}:${mins}`;

    ctx.font = `${timeFontSize}px "Nova Flat", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(timeStr, rightAlignX, headerBaselineY);
  }

  // 2. 斜線ストライプバー (18個の平行四辺形を均等配置)
  const stripeY = headerBaselineY + stripeTopGap;
  const totalWidth = rightAlignX - leftAlignX;
  const stripeCount = 18;
  const slant = stripeH * 0.58;
  const stepX = (totalWidth - slant) / stripeCount;
  const barW = stepX * 0.50;

  ctx.fillStyle = state.textColor;
  for (let i = 0; i < stripeCount; i++) {
    const bx = leftAlignX + i * stepX;
    ctx.beginPath();
    ctx.moveTo(bx + slant, stripeY);
    ctx.lineTo(bx + slant + barW, stripeY);
    ctx.lineTo(bx + barW, stripeY + stripeH);
    ctx.lineTo(bx, stripeY + stripeH);
    ctx.closePath();
    ctx.fill();
  }

  // 3. カレンダーグリッド（文字間を意識した1文字ずつの等間隔描画）
  const firstRowCenterY = stripeY + stripeH + gridTopGap;
  ctx.font = `${dateFontSize}px "Nova Flat", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 2桁の数字（例: "04", "22"）の10の位と1の位の中心オフセットを固定し、文字間を完全に均等化
  const digitOffset = dateFontSize * 0.33;

  gridData.forEach((cell, idx) => {
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const cx = startX + col * colStep;
    const cy = firstRowCenterY + row * rowStep;

    // 色の決定
    let cellColor = state.textColor;
    if (state.weekendMode === 'color') {
      if (col === 0) cellColor = state.sunColor;
      else if (col === 6) cellColor = state.satColor;
    }

    ctx.save();
    ctx.fillStyle = cellColor;
    if (!cell.isCurrentMonth) {
      ctx.globalAlpha = 0.38; // 前月・翌月の日付は薄く表示
    }

    const numStr = String(cell.day).padStart(2, '0');
    // 10の位と1の位をそれぞれの座標に中央揃えで描画（プロポーショナルによるガタつきを排除）
    ctx.fillText(numStr[0], cx - digitOffset, cy);
    ctx.fillText(numStr[1], cx + digitOffset, cy);
    ctx.restore();

    // 撮影日当日の丸枠（リング）ハイライト
    if (cell.isTargetDay) {
      ctx.save();
      ctx.strokeStyle = state.ringColor;
      ctx.lineWidth = Math.max(2, calW * 0.0085);
      const radius = dateFontSize * 0.88;
      ctx.beginPath();
      // フォントの視覚的中心に合わせるためY軸をわずかに補正
      ctx.arc(cx, cy - dateFontSize * 0.03, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.restore();
}

// 指定された年月のカレンダー配列（日曜始まり）を生成
function generateCalendarGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const targetDay = date.getDate();

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0(Sun) - 6(Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];

  // 前月の末尾
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      isTargetDay: false
    });
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isCurrentMonth: true,
      isTargetDay: d === targetDay
    });
  }

  // 翌月の先頭（7の倍数になるまで埋める。構図.jpgに合わせ5行または6行）
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay++,
      isCurrentMonth: false,
      isTargetDay: false
    });
  }

  return cells;
}

// 24MP フル解像度書き出し＆保存
async function export24MPImage() {
  if (!state.image) return;
  loadingOverlay.hidden = false;

  // UIスレッドにローディング表示を反映させてからレンダリング開始
  await new Promise(r => setTimeout(r, 60));

  try {
    const aspect = parseAspectRatio(state.canvasRatio, state.image.width, state.image.height);
    const { width, height } = calculate24MPDimensions(aspect);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d');

    renderComposition(exportCtx, width, height);

    exportCanvas.toBlob(async (blob) => {
      loadingOverlay.hidden = true;
      if (!blob) return;

      const pad = n => String(n).padStart(2, '0');
      const d = state.selectedDate;
      const fileName = `Calendar_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_24MP.jpg`;

      // Download実行
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    }, 'image/jpeg', 0.95);
  } catch (err) {
    console.error('Export Error:', err);
    loadingOverlay.hidden = true;
    alert('書き出し中にエラーが発生しました。');
  }
}
