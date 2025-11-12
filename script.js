/* Wishly v3.2
 - Card size presets (canvas aspect)
 - Full-width preview on mobile
 - Auto-save / restore last design
 - Drag + scale uploaded image
 - Live preview, download, share, reminders
*/

// DOM
const canvas = document.getElementById("cardCanvas");
const ctx = canvas.getContext("2d");

const toName = document.getElementById("toName");
const occasion = document.getElementById("occasion");
const cardSize = document.getElementById("cardSize");
const titleEl = document.getElementById("title");
const titleColor = document.getElementById("titleColor");
const messageEl = document.getElementById("message");
const photoInput = document.getElementById("photo");
const scaleInput = document.getElementById("scale");
const bgPreset = document.getElementById("bgPreset");
const bgColor = document.getElementById("bgColor");
const eventDate = document.getElementById("eventDate");

const suggestBtn = document.getElementById("suggestBtn");
const randomThemeBtn = document.getElementById("randomTheme");
const randomMsgBtn = document.getElementById("randomMsg");
const downloadBtn = document.getElementById("download");
const shareBtn = document.getElementById("share");
const saveReminderBtn = document.getElementById("saveReminder");
const clearSavedBtn = document.getElementById("clearSaved");
const upcomingDiv = document.getElementById("upcoming");
const canvasWrap = document.getElementById("canvasWrap");

let uploadedImage = null;
let imgState = { x: 60, y: 60, w: 420, h: 420, scale: 1 };
let dragging = false,
  dragOffset = { x: 0, y: 0 };

// suggestions
const suggestions = {
  birthday: ["Happy bday! 🎂", "Have a lit day ✨"],
  anniversary: ["Forever ❤️", "Cheers to you two 💕"],
  invitation: ["Join us 🎉"],
  custom: ["Thinking of you ✨"],
};
function pickSuggestion(k) {
  const arr = suggestions[k] || suggestions.custom;
  return arr[Math.floor(Math.random() * arr.length)];
}

// auto-save key
const LS_KEY = "wishly_last_design_v3";

// responsive canvas sizing: base pixel width for download quality
const BASE_WIDTH = 1000; // download width in px; height computed using ratio

// helpers to set canvas size according to cardSize value and container width
function setCanvasSizeFromPreset(animated = true) {
  const ratio = parseFloat(cardSize.value) || 1;
  // compute available width: on mobile, full width of canvasWrap
  const rect = canvasWrap.getBoundingClientRect();
  const availW = Math.min(rect.width - 24, window.innerWidth - 24); // padding
  // we want preview width to be availW but maintain aspect ratio
  const previewWidth = Math.floor(availW);
  const previewHeight = Math.floor(previewWidth * ratio);
  // set canvas CSS size and internal pixel buffer (for reasonable quality)
  canvas.style.width = previewWidth + "px";
  canvas.style.height = previewHeight + "px";
  // set actual pixel size proportional to BASE_WIDTH for download quality
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1); // cap for performance
  canvas.width = Math.round(
    BASE_WIDTH * (previewWidth / Math.min(BASE_WIDTH, previewWidth))
  );
  canvas.height = Math.round(canvas.width * ratio);
  // center image if needed
  if (!uploadedImage) {
    imgState.x = 60;
    imgState.y = 60;
  } else {
    // ensure image stays inside
    constrainImage();
  }
  // subtle animated resize (CSS)
  if (animated) {
    canvasWrap.style.transition = "all .25s ease";
    setTimeout(() => (canvasWrap.style.transition = ""), 260);
  }
  drawCard();
}

// load saved design if exists
function restoreLastDesign() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    toName.value = obj.toName || "";
    occasion.value = obj.occasion || "birthday";
    cardSize.value = obj.cardSize || "1";
    titleEl.value = obj.title || "";
    titleColor.value = obj.titleColor || "#ff6fa3";
    messageEl.value = obj.message || "";
    bgPreset.value = obj.bgPreset || "blush";
    bgColor.value = obj.bgColor || "#fff5f8";
    eventDate.value = obj.eventDate || "";
    if (obj.image) {
      const img = new Image();
      img.onload = () => {
        uploadedImage = img;
        imgState.w = obj.imgW || Math.min(420, img.width);
        imgState.h =
          obj.imgH || Math.min(420, img.height * (imgState.w / img.width));
        imgState.x = obj.imgX || 60;
        imgState.y = obj.imgY || 60;
        imgState.scale = obj.imgScale || 1;
        setCanvasSizeFromPreset(false);
      };
      img.src = obj.image;
    } else {
      setCanvasSizeFromPreset(false);
      drawCard();
    }
  } catch (e) {
    console.warn("restore failed", e);
  }
}
function saveCurrentDesign() {
  const obj = {
    toName: toName.value,
    occasion: occasion.value,
    cardSize: cardSize.value,
    title: titleEl.value,
    titleColor: titleColor.value,
    message: messageEl.value,
    bgPreset: bgPreset.value,
    bgColor: bgColor.value,
    eventDate: eventDate.value,
    image: uploadedImage ? getImageDataURLFromState() : null,
    imgW: imgState.w,
    imgH: imgState.h,
    imgX: imgState.x,
    imgY: imgState.y,
    imgScale: imgState.scale,
    savedAt: Date.now(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

// image loader
photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) {
    uploadedImage = null;
    drawCard();
    saveCurrentDesign();
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    const img = new Image();
    img.onload = () => {
      uploadedImage = img;
      imgState.w = Math.min(600, img.width);
      imgState.h = Math.min(600, img.height * (imgState.w / img.width));
      imgState.x = (canvas.width - imgState.w * imgState.scale) / 2;
      imgState.y = (canvas.height - imgState.h * imgState.scale) / 2;
      imgState.scale = 1;
      scaleInput.value = 1;
      saveCurrentDesign();
      drawCard();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// scale listener
scaleInput.addEventListener("input", () => {
  imgState.scale = parseFloat(scaleInput.value);
  constrainImage();
  drawCard();
  saveCurrentDesign();
});

// drag logic (mouse & touch)
function getCanvasPointer(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    const t = e.touches[0];
    return {
      x: (t.clientX - rect.left) * (canvas.width / rect.width),
      y: (t.clientY - rect.top) * (canvas.height / rect.height),
    };
  } else {
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
}
function pointInImage(px, py) {
  if (!uploadedImage) return false;
  const w = imgState.w * imgState.scale,
    h = imgState.h * imgState.scale;
  return (
    px >= imgState.x &&
    px <= imgState.x + w &&
    py >= imgState.y &&
    py <= imgState.y + h
  );
}

canvas.addEventListener("mousedown", (e) => {
  const p = getCanvasPointer(e);
  if (pointInImage(p.x, p.y)) {
    dragging = true;
    dragOffset.x = p.x - imgState.x;
    dragOffset.y = p.y - imgState.y;
    canvas.style.cursor = "grabbing";
  } else {
    // center image
    if (uploadedImage) {
      imgState.x = (canvas.width - imgState.w * imgState.scale) / 2;
      imgState.y = (canvas.height - imgState.h * imgState.scale) / 2;
      drawCard();
      saveCurrentDesign();
    }
  }
});
window.addEventListener("mouseup", () => {
  dragging = false;
  canvas.style.cursor = "default";
  saveCurrentDesign();
});

canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const p = getCanvasPointer(e);
  imgState.x = p.x - dragOffset.x;
  imgState.y = p.y - dragOffset.y;
  constrainImage();
  drawCard();
});

canvas.addEventListener("touchstart", (e) => {
  const p = getCanvasPointer(e);
  if (pointInImage(p.x, p.y)) {
    dragging = true;
    dragOffset.x = p.x - imgState.x;
    dragOffset.y = p.y - imgState.y;
  }
});
canvas.addEventListener("touchmove", (e) => {
  if (!dragging) return;
  e.preventDefault();
  const p = getCanvasPointer(e);
  imgState.x = p.x - dragOffset.x;
  imgState.y = p.y - dragOffset.y;
  constrainImage();
  drawCard();
});
window.addEventListener("touchend", () => {
  dragging = false;
  saveCurrentDesign();
});

// keep image inside bounds
function constrainImage() {
  const w = imgState.w * imgState.scale,
    h = imgState.h * imgState.scale;
  imgState.x = Math.min(Math.max(imgState.x, -w * 0.6), canvas.width - w * 0.4);
  imgState.y = Math.min(
    Math.max(imgState.y, -h * 0.6),
    canvas.height - h * 0.4
  );
}

// drawing helpers
function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackgroundPreset(key) {
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  if (key === "blush") {
    g.addColorStop(0, "#fff5f8");
    g.addColorStop(1, "#fff0f3");
  } else if (key === "sky") {
    g.addColorStop(0, "#f0fbff");
    g.addColorStop(1, "#e6f7ff");
  } else if (key === "mint") {
    g.addColorStop(0, "#f5fff8");
    g.addColorStop(1, "#ecfff3");
  } else if (key === "lilac") {
    g.addColorStop(0, "#fbf5ff");
    g.addColorStop(1, "#f6efff");
  } else if (key === "cream") {
    g.addColorStop(0, "#fffdf6");
    g.addColorStop(1, "#fff8ec");
  } else if (key === "charcoal") {
    g.addColorStop(0, "#0b0f12");
    g.addColorStop(1, "#0b0f15");
  } else {
    g.addColorStop(0, "#fffdf6");
    g.addColorStop(1, "#fff8ec");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawImageRounded(img, x, y, w, h, r) {
  ctx.save();
  roundPath(ctx, x - 4, y - 4, w + 8, h + 8, r + 8);
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fill();
  ctx.clip();

  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio,
    ih = img.height * ratio;
  const ix = img.width / 2 - w / ratio / 2;
  const iy = img.height / 2 - h / ratio / 2;

  // Fit using cover logic (center crop)
  ctx.drawImage(
    img,
    ix,
    iy,
    img.width - ix * 2,
    img.height - iy * 2,
    x,
    y,
    w,
    h
  );
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

// pick palette
function pickPalette(kind) {
  if (kind === "birthday")
    return {
      border: "#ffdfe8",
      text: "#222",
      accent: "#ff6fa3",
      sub: "#6c6c6c",
      decor: "rgba(255,111,163,0.06)",
    };
  if (kind === "anniversary")
    return {
      border: "#fff0f6",
      text: "#222",
      accent: "#ff7fa9",
      sub: "#6c6c6c",
      decor: "rgba(255,127,169,0.05)",
    };
  if (kind === "invitation")
    return {
      border: "#dfefff",
      text: "#161617",
      accent: "#6fd1ff",
      sub: "#6c6c6c",
      decor: "rgba(109,211,255,0.04)",
    };
  if (kind === "charcoal")
    return {
      border: "#0b0b0b",
      text: "#fff",
      accent: "#cfefff",
      sub: "rgba(255,255,255,0.9)",
      decor: "rgba(255,255,255,0.03)",
    };
  return {
    border: "#cde7ff",
    text: "#161617",
    accent: "#6fd1ff",
    sub: "#6c6c6c",
    decor: "rgba(109,211,255,0.04)",
  };
}

function drawDecorations(color) {
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const rad = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.fillStyle = color || "rgba(255,255,255,0.06)";
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// main draw
function drawCard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pal = pickPalette(occasion.value);
  // background: custom color overrides preset
  if (bgColor && bgColor.value) {
    const base = bgColor.value;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, base);
    g.addColorStop(1, lighten(base, 0.14));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    drawBackgroundPreset(bgPreset.value);
  }

  // frame border
  ctx.save();
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 2;
  roundPath(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 18);
  ctx.stroke();
  ctx.restore();

  // image
  if (uploadedImage) {
    const w = imgState.w * imgState.scale;
    const h = imgState.h * imgState.scale;
    drawImageRounded(uploadedImage, imgState.x, imgState.y, w, h, 20);
  }

  // title
  if (titleEl.value) {
    ctx.save();
    ctx.font = '700 36px "Dancing Script", cursive';
    ctx.fillStyle = titleColor.value || pal.accent;
    ctx.textAlign = "left";
    ctx.fillText(titleEl.value, uploadedImage ? canvas.width * 0.52 : 80, 100);
    ctx.restore();
  }

  // message
  ctx.save();
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = pal.text;
  const textX = uploadedImage ? canvas.width * 0.52 : 80;
  const maxW = uploadedImage ? canvas.width * 0.46 : canvas.width - 160;
  wrapText(ctx, messageEl.value || "Sending you love ✨", textX, 150, maxW, 32);
  ctx.restore();

  // date/venue (invitation)
  if (eventDate.value) {
    ctx.save();
    ctx.font = "500 16px Poppins, sans-serif";
    ctx.fillStyle = pal.sub;
    const d = new Date(eventDate.value);
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    ctx.fillText(`📅 ${dateStr}`, textX, canvas.height - 96);
    ctx.restore();
  }

  // recipient
  ctx.save();
  ctx.font = "600 18px Poppins, sans-serif";
  ctx.fillStyle = pal.sub;
  ctx.fillText(
    `— ${toName.value || "Someone Special"}`,
    textX,
    canvas.height - 48
  );
  ctx.restore();

  drawDecorations(pal.decor);
}

// lighten helper
function lighten(hex, pct) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * pct));
  const ng = Math.min(255, Math.round(g + (255 - g) * pct));
  const nb = Math.min(255, Math.round(b + (255 - b) * pct));
  return `rgb(${nr},${ng},${nb})`;
}

// snapshot for saved image
function getImageDataURLFromState() {
  if (!uploadedImage) return null;
  const temp = document.createElement("canvas");
  temp.width = Math.round(imgState.w * imgState.scale);
  temp.height = Math.round(imgState.h * imgState.scale);
  const tctx = temp.getContext("2d");
  tctx.drawImage(uploadedImage, 0, 0, temp.width, temp.height);
  return temp.toDataURL("image/png");
}

// download
downloadBtn.addEventListener("click", () => {
  // redrawing to ensure current state
  drawCard();
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(toName.value || "card").replace(/\s+/g, "_")}_wish.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
});

// share
shareBtn.addEventListener("click", async () => {
  try {
    drawCard();
    if (navigator.canShare) {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      const file = new File([blob], "wishly.png", { type: "image/png" });
      await navigator.share({
        files: [file],
        title: "A small wish",
        text: messageEl.value || "Hey!",
      });
    } else {
      alert("Share not supported — downloading instead.");
      downloadBtn.click();
    }
  } catch (e) {
    console.warn(e);
    alert("Share failed");
  }
});

// reminders + save/clear
const REM_KEY = "wishly_events_v3";
saveReminderBtn.addEventListener("click", () => {
  const rdate = eventDate.value;
  const saved = JSON.parse(localStorage.getItem(REM_KEY) || "[]");
  const next = rdate ? computeNextOccurrence(rdate) : null;
  const obj = {
    id: Date.now(),
    name: toName.value || "Someone",
    occasion: occasion.value,
    title: titleEl.value || "",
    message: messageEl.value || "",
    date: rdate || null,
    next,
    bgPreset: bgPreset.value,
    bgColor: bgColor.value,
    image: uploadedImage ? getImageDataURLFromState() : null,
  };
  saved.push(obj);
  localStorage.setItem(REM_KEY, JSON.stringify(saved));
  toast("Saved reminder ✔️");
  renderUpcoming();
});
clearSavedBtn.addEventListener("click", () => {
  if (confirm("Clear all saved reminders?")) {
    localStorage.removeItem(REM_KEY);
    renderUpcoming();
  }
});

function computeNextOccurrence(dateInput) {
  const [y, m, d] = dateInput.split("-").map((n) => parseInt(n, 10));
  const now = new Date();
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  return next.toISOString();
}
function renderUpcoming() {
  const saved = JSON.parse(localStorage.getItem(REM_KEY) || "[]");
  upcomingDiv.innerHTML = "";
  if (!saved.length) {
    upcomingDiv.innerHTML = '<p class="hint">No saved reminders yet.</p>';
    return;
  }
  saved.sort((a, b) => new Date(a.next || 0) - new Date(b.next || 0));
  saved.forEach((ev) => {
    const when = ev.next ? new Date(ev.next) : null;
    const diffDays = when
      ? Math.ceil((when - new Date()) / (1000 * 60 * 60 * 24))
      : "—";
    const div = document.createElement("div");
    div.className = "reminder";
    div.innerHTML = `<div><strong>${
      ev.name
    }</strong> <span style="color:#aefeff">• ${capitalize(ev.occasion)}</span>
      <div style="font-size:13px;color:#cfefff;margin-top:6px">${
        ev.title || ev.message
      }</div></div><div class="when">${
      diffDays === "—" ? "—" : diffDays + "d"
    }</div>`;
    upcomingDiv.appendChild(div);
  });
}

// small helpers
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function toast(msg, ms = 1500) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "22px",
    background: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "10px",
    zIndex: 99999,
  });
  document.body.appendChild(el);
  setTimeout(() => (el.style.opacity = "0"), ms - 120);
  setTimeout(() => el.remove(), ms + 200);
}

// suggestions & random theme
suggestBtn.addEventListener(
  "click",
  () => (messageEl.value = pickSuggestion(occasion.value))
);
randomMsgBtn.addEventListener("click", () => {
  const keys = Object.keys(suggestions);
  messageEl.value = pickSuggestion(
    keys[Math.floor(Math.random() * keys.length)]
  );
});
randomThemeBtn.addEventListener("click", () => {
  const keys = ["blush", "sky", "mint", "lilac", "cream", "charcoal"];
  bgPreset.value = keys[Math.floor(Math.random() * keys.length)];
  drawCard();
  saveCurrentDesign();
});

// live redraw on inputs
[
  toName,
  occasion,
  titleEl,
  titleColor,
  messageEl,
  scaleInput,
  bgPreset,
  bgColor,
  eventDate,
  cardSize,
].forEach((el) => {
  el.addEventListener("input", () => {
    if (el === cardSize) setCanvasSizeFromPreset();
    else drawCard();
    saveCurrentDesign();
  });
});

// initial responsive size + restore
window.addEventListener("resize", () => setCanvasSizeFromPreset(false));
restoreLastDesign();
setTimeout(() => {
  setCanvasSizeFromPreset(false);
  drawCard();
  renderUpcoming();
  ensureNotificationPermission();
}, 120);

// notification permission
async function ensureNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {}
  }
}

// utility: capture current image drawn for saving
function getImageDataURLFromState() {
  if (!uploadedImage) return null;
  const temp = document.createElement("canvas");
  temp.width = Math.round(imgState.w * imgState.scale);
  temp.height = Math.round(imgState.h * imgState.scale);
  const tctx = temp.getContext("2d");
  tctx.drawImage(uploadedImage, 0, 0, temp.width, temp.height);
  return temp.toDataURL("image/png");
}
