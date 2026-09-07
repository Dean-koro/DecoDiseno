const SECCIONES = {
  cortinas: { jsonFile: "../content/galeria-cortinas.json", githubPath: "public/content/galeria-cortinas.json" },
  tapiceria_mobi: { jsonFile: "../content/galeria-tapiceria-mobi.json", githubPath: "public/content/galeria-tapiceria-mobi.json" },
  toldos: { jsonFile: "../content/galeria-toldos.json", githubPath: "public/content/galeria-toldos.json" },
  tapiceria_auto: { jsonFile: "../content/galeria-tapiceria-auto.json", githubPath: "public/content/galeria-tapiceria-auto.json" },
  tapiceria_nautica: { jsonFile: "../content/galeria-tapiceria-nautica.json", githubPath: "public/content/galeria-tapiceria-nautica.json" },
  tapiceria_exterior: { jsonFile: "../content/galeria-exterior.json", githubPath: "public/content/galeria-exterior.json" }
};

const ADMIN_GITHUB_LOGIN = "bot-DecoDiseno";
const REPO_OWNER_NAME = "Dean-koro/DecoDiseno";
const OAUTH_WORKER_URL = "https://auth.decodiseno.com.mx/auth";

let listaImagenes = [];
let listaImagenesOriginal = []; // Para detectar si hubo cambios
let seccionActual = "cortinas";
let cropperInstance = null;
let indiceEncuadre = null;
let indiceAEliminar = null;

document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginGitHubBtn");
  const loginScreen = document.getElementById("loginScreen");
  const loginError = document.getElementById("loginError");
  const app = document.getElementById("app");

  const mostrarLogin = (mensaje = "") => {
    loginScreen?.classList.remove("hidden");
    app?.classList.add("hidden");
    if (loginError) {
      loginError.textContent = mensaje;
      loginError.classList.toggle("hidden", !mensaje);
    }
  };

  const mostrarApp = () => {
    loginScreen?.classList.add("hidden");
    app?.classList.remove("hidden");

    // Registrar listeners solo una vez
    if (!window._adminListenersReady) {
      document.getElementById("sectionSelect")?.addEventListener("change", (e) => cargarGaleria(e.target.value));
      document.getElementById("saveBtn")?.addEventListener("click", guardarDirectoEnGitHub);
      document.getElementById("cancelCropBtn")?.addEventListener("click", cerrarModalEncuadre);
      document.getElementById("applyCropBtn")?.addEventListener("click", aplicarEncuadre);
      document.getElementById("cancelDeleteBtn")?.addEventListener("click", cerrarModalBorrado);
      document.getElementById("confirmDeleteBtn")?.addEventListener("click", confirmarEliminacion);
      window._adminListenersReady = true;
    }

    cargarGaleria(seccionActual);
  };

  const esAdministrador = (usuario) => {
    if (!usuario) return false;
    const login = usuario.login || usuario.username || usuario.name;
    return login?.toLowerCase() === ADMIN_GITHUB_LOGIN.toLowerCase();
  };

  const verificarSesionExistente = async () => {
    const token = localStorage.getItem("github_token");
    if (!token) return null;

    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}` }
      });
      if (res.ok) {
        return await res.json();
      } else {
        localStorage.removeItem("github_token");
      }
    } catch (e) {
      console.warn("Error al verificar token existente:", e);
    }
    return null;
  };

  const iniciarSesionOAuth = () => {
    if (!loginButton) return;

    loginButton.disabled = true;
    const spanBtn = loginButton.querySelector("span");
    if (spanBtn) spanBtn.textContent = "Conectando con GitHub...";

    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      OAUTH_WORKER_URL,
      "GitHub_OAuth",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
    );

    if (!popup) {
      alert("Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para continuar.");
      loginButton.disabled = false;
      if (spanBtn) spanBtn.textContent = "Iniciar Sesión con GitHub";
      return;
    }

    const handleMessage = async (event) => {
      if (typeof event.data !== "string" || !event.data.startsWith("authorization:github:success:")) {
        return;
      }

      window.removeEventListener("message", handleMessage);
      if (popup && !popup.closed) popup.close();

      try {
        const rawData = event.data.replace("authorization:github:success:", "");
        const parsedData = JSON.parse(rawData);
        const token = parsedData.token;

        if (!token) throw new Error("No se recibió token");

        localStorage.setItem("github_token", token);

        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${token}` }
        });

        if (!userRes.ok) throw new Error("Error al verificar usuario");

        const usuario = await userRes.json();

        if (esAdministrador(usuario)) {
          mostrarApp();
        } else {
          localStorage.removeItem("github_token");
          mostrarLogin(`Acceso denegado. La cuenta "${usuario.login}" no está autorizada.`);
        }
      } catch (e) {
        console.error("Error procesando OAuth:", e);
        localStorage.removeItem("github_token");
        mostrarLogin("Error al procesar la autenticación.");
      } finally {
        loginButton.disabled = false;
        if (spanBtn) spanBtn.textContent = "Iniciar Sesión con GitHub";
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        loginButton.disabled = false;
        if (spanBtn) spanBtn.textContent = "Iniciar Sesión con GitHub";
      }
    }, 500);
  };

  loginButton?.addEventListener("click", iniciarSesionOAuth);

  verificarSesionExistente().then((usuario) => {
    if (esAdministrador(usuario)) {
      mostrarApp();
    } else {
      mostrarLogin();
    }
  });
});

function resolverRutaImagen(src) {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  let limpia = src.replace(/^(\.\.\/|\/|public\/)+/, "");
  return "../" + limpia;
}

async function cargarGaleria(seccion) {
  seccionActual = seccion;
  const configSeccion = SECCIONES[seccion];

  try {
    const res = await fetch(`${configSeccion.jsonFile}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      listaImagenes = Array.isArray(data) ? data : (data.imagenes || []);
    } else {
      listaImagenes = [];
    }
  } catch (e) {
    console.error("Error al obtener el JSON:", e);
    listaImagenes = [];
  }

  // Guardar copia original para detectar cambios
  listaImagenesOriginal = JSON.parse(JSON.stringify(listaImagenes));
  renderizarGrilla();
}

function hayCambiosPendientes() {
  return JSON.stringify(listaImagenes) !== JSON.stringify(listaImagenesOriginal);
}

function renderizarGrilla() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (listaImagenes.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm";
    emptyMsg.innerHTML = "No hay imágenes en esta galería aún. Haz clic en <strong>'Añadir Imagen'</strong> para agregar una.";
    grid.appendChild(emptyMsg);
  }

  listaImagenes.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "group relative aspect-square bg-slate-200 rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex items-center justify-center";

    const img = document.createElement("img");
    img.src = resolverRutaImagen(item.src);
    img.alt = item.alt || "";
    img.className = "w-full h-full object-cover";
    img.onerror = () => {
      img.src = "https://via.placeholder.com/400x400?text=Imagen+no+encontrada";
    };

    const overlay = document.createElement("div");
    overlay.className = "absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3";

    const topBar = document.createElement("div");
    topBar.className = "flex justify-between items-center";

    const navGroup = document.createElement("div");
    navGroup.className = "flex gap-1";

    if (index > 0) {
      navGroup.appendChild(crearBotonControl("←", () => moverImagen(index, -1)));
    }
    if (index < listaImagenes.length - 1) {
      navGroup.appendChild(crearBotonControl("→", () => moverImagen(index, 1)));
    }

    const deleteBtn = crearBotonControl("✕", () => solicitarEliminacion(index), "bg-red-600/80 hover:bg-red-600");
    topBar.appendChild(navGroup);
    topBar.appendChild(deleteBtn);

    const cropBtn = document.createElement("button");
    cropBtn.className = "w-full py-1.5 bg-white/90 hover:bg-white text-slate-900 text-xs font-bold rounded-lg transition";
    cropBtn.textContent = "Ajustar Encuadre";
    cropBtn.addEventListener("click", () => abrirModalEncuadre(index));

    overlay.appendChild(topBar);
    overlay.appendChild(cropBtn);

    card.appendChild(img);
    card.appendChild(overlay);
    grid.appendChild(card);
  });

  renderizarTarjetaAgregar(grid);
}

function crearBotonControl(texto, callback, bgClass = "bg-white/20 hover:bg-white/40") {
  const btn = document.createElement("button");
  btn.className = `w-8 h-8 rounded-lg ${bgClass} text-white flex items-center justify-center font-bold`;
  btn.textContent = texto;
  btn.addEventListener("click", callback);
  return btn;
}

function renderizarTarjetaAgregar(contenedorGrid) {
  const addCard = document.createElement("div");
  addCard.className = "aspect-square rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 hover:bg-slate-100/50 transition flex flex-col items-center justify-center p-4 cursor-pointer text-center group";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "hidden";
  fileInput.accept = "image/*";
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) procesarArchivoNuevo(e.target.files[0]);
  });

  addCard.addEventListener("click", () => fileInput.click());
  addCard.addEventListener("dragover", (e) => { e.preventDefault(); addCard.classList.add("border-slate-800", "bg-slate-200/50"); });
  addCard.addEventListener("dragleave", () => addCard.classList.remove("border-slate-800", "bg-slate-200/50"));
  addCard.addEventListener("drop", (e) => {
    e.preventDefault();
    addCard.classList.remove("border-slate-800", "bg-slate-200/50");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) procesarArchivoNuevo(e.dataTransfer.files[0]);
  });

  addCard.innerHTML = `
    <div class="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-slate-300 flex items-center justify-center text-slate-600 mb-2 transition">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
    </div>
    <span class="text-xs font-bold text-slate-700">Añadir Imagen</span>
    <span class="text-[10px] text-slate-400 mt-1">Haz clic o arrastra aquí</span>
  `;
  addCard.appendChild(fileInput);
  contenedorGrid.appendChild(addCard);
}

function moverImagen(index, direccion) {
  const nuevoIndice = index + direccion;
  if (nuevoIndice < 0 || nuevoIndice >= listaImagenes.length) return;
  const temp = listaImagenes[index];
  listaImagenes[index] = listaImagenes[nuevoIndice];
  listaImagenes[nuevoIndice] = temp;
  renderizarGrilla();
}

function solicitarEliminacion(index) {
  indiceAEliminar = index;
  document.getElementById("deleteModal")?.classList.remove("hidden");
}

function cerrarModalBorrado() {
  indiceAEliminar = null;
  document.getElementById("deleteModal")?.classList.add("hidden");
}

function confirmarEliminacion() {
  if (indiceAEliminar !== null) {
    listaImagenes.splice(indiceAEliminar, 1);
    cerrarModalBorrado();
    renderizarGrilla();
  }
}

function procesarArchivoNuevo(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    listaImagenes.push({
      src: e.target.result,
      alt: file.name.replace(/\.[^/.]+$/, "")
    });
    renderizarGrilla();
    abrirModalEncuadre(listaImagenes.length - 1);
  };
  reader.readAsDataURL(file);
}

function abrirModalEncuadre(index) {
  indiceEncuadre = index;
  const modal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  if (!modal || !cropImage) return;

  cropImage.src = resolverRutaImagen(listaImagenes[index].src);
  modal.classList.remove("hidden");

  if (cropperInstance) cropperInstance.destroy();

  cropperInstance = new Cropper(cropImage, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 0.9,
  });
}

function cerrarModalEncuadre() {
  document.getElementById("cropModal")?.classList.add("hidden");
  if (cropperInstance) cropperInstance.destroy();
}

function aplicarEncuadre() {
  if (!cropperInstance || indiceEncuadre === null) return;

  const canvas = cropperInstance.getCroppedCanvas({ width: 800, height: 800 });
  const croppedBase64 = canvas.toDataURL("image/jpeg", 0.85);

  listaImagenes[indiceEncuadre].src = croppedBase64;
  cerrarModalEncuadre();
  renderizarGrilla();
}

async function guardarDirectoEnGitHub() {
  const btn = document.getElementById("saveBtn");
  const alertBox = document.getElementById("statusAlert");

  if (!btn || !alertBox) return;

  // Si no hay cambios, avisar y no subir nada
  if (!hayCambiosPendientes()) {
    alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-amber-100 text-amber-800";
    alertBox.textContent = "No hay cambios pendientes para publicar.";
    alertBox.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Publicando cambios...";
  alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-blue-100 text-blue-800";
  alertBox.textContent = "Enviando actualización a GitHub...";
  alertBox.classList.remove("hidden");

  const configSeccion = SECCIONES[seccionActual];
  const contenidoJson = JSON.stringify({ imagenes: listaImagenes }, null, 2);
  const token = localStorage.getItem("github_token");

  if (!token) {
    descargarJsonFallback(contenidoJson, configSeccion.githubPath);
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Publicar Cambios en la Web`;
    return;
  }

  try {
    const url = `https://api.github.com/repos/${REPO_OWNER_NAME}/contents/${configSeccion.githubPath}`;

    // 1. Obtener SHA actual
    let sha = null;
    const getRes = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      throw new Error(`Error al obtener archivo: ${getRes.status}`);
    }

    // 2. Codificar contenido
    const contentBase64 = btoa(unescape(encodeURIComponent(contenidoJson)));

    // 3. Crear o actualizar
    const body = {
      message: `Actualizar galería de ${seccionActual} desde panel admin`,
      content: contentBase64,
      branch: "main"
    };

    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (putRes.ok) {
      // Actualizar la copia original para que ya no detecte cambios
      listaImagenesOriginal = JSON.parse(JSON.stringify(listaImagenes));

      alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-green-100 text-green-800";
      alertBox.textContent = "¡Cambios publicados exitosamente en GitHub!";
    } else {
      const errorData = await putRes.json().catch(() => ({}));
      console.error("Error de GitHub:", putRes.status, errorData);
      throw new Error(`GitHub API Error: ${putRes.status} - ${errorData.message || "Error desconocido"}`);
    }
  } catch (err) {
    console.error("Error al publicar:", err);
    alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-red-100 text-red-800";
    alertBox.textContent = `Error al publicar: ${err.message}. Se descargará el archivo como respaldo.`;
    descargarJsonFallback(contenidoJson, configSeccion.githubPath);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Publicar Cambios en la Web`;
  }
}

function descargarJsonFallback(jsonStr, rutaArchivo) {
  const alertBox = document.getElementById("statusAlert");
  const nombreArchivo = rutaArchivo.split("/").pop();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);

  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", nombreArchivo);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  if (alertBox) {
    alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-amber-100 text-amber-800";
    alertBox.innerHTML = `No hay sesión activa o el token venció. Se ha descargado <strong>${nombreArchivo}</strong> para guardar manualmente en <code>${rutaArchivo}</code>.`;
  }
}