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
const OAUTH_WORKER_URL = "https://decap-oauth.25308167.workers.dev/auth?provider=github&scope=repo";

let listaImagenes = [];
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

    document.getElementById("sectionSelect")?.addEventListener("change", (e) => cargarGaleria(e.target.value));
    document.getElementById("saveBtn")?.addEventListener("click", guardarDirectoEnGitHub);
    document.getElementById("cancelCropBtn")?.addEventListener("click", cerrarModalEncuadre);
    document.getElementById("applyCropBtn")?.addEventListener("click", aplicarEncuadre);
    document.getElementById("cancelDeleteBtn")?.addEventListener("click", cerrarModalBorrado);
    document.getElementById("confirmDeleteBtn")?.addEventListener("click", confirmarEliminacion);

    cargarGaleria(seccionActual);
  };

  const esAdministrador = (usuario) => {
    if (!usuario) return false;
    const login = usuario.login || usuario.username || usuario.name;
    return login?.toLowerCase() === ADMIN_GITHUB_LOGIN.toLowerCase();
  };

  // Validar si tenemos un token en localStorage y consultar /user a la API de GitHub
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

    // Configurar ventana emergente
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

    // Escuchar la respuesta postMessage proveniente del Worker de Cloudflare
    const handleMessage = async (event) => {
      if (event.data && typeof event.data === "string" && event.data.startsWith("authorization:github:success:")) {
        window.removeEventListener("message", handleMessage);

        try {
          const rawData = event.data.replace("authorization:github:success:", "");
          const parsedData = JSON.parse(rawData);
          const token = parsedData.token;

          if (token) {
            localStorage.setItem("github_token", token);

            // Obtener perfil del usuario desde GitHub
            const userRes = await fetch("https://api.github.com/user", {
              headers: { Authorization: `token ${token}` }
            });

            if (userRes.ok) {
              const usuario = await userRes.json();
              if (esAdministrador(usuario)) {
                mostrarApp();
              } else {
                mostrarLogin(`Acceso denegado. La cuenta "${usuario.login}" no está autorizada.`);
              }
            } else {
              mostrarLogin("Error al verificar los datos de la cuenta en GitHub.");
            }
          }
        } catch (e) {
          console.error("Error procesando mensaje OAuth:", e);
          mostrarLogin("Error al procesar la respuesta de autenticación.");
        } finally {
          loginButton.disabled = false;
          if (spanBtn) spanBtn.textContent = "Iniciar Sesión con GitHub";
        }
      }
    };

    window.addEventListener("message", handleMessage, false);
  };

  loginButton?.addEventListener("click", iniciarSesionOAuth);

  // Verificar si ya hay una sesión guardada
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
  renderizarGrilla();
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

    // 1. Obtener SHA actual del archivo JSON en GitHub
    let sha = "";
    const getRes = await fetch(url, {
      headers: { Authorization: `token ${token}` }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Subir nuevo Commit a GitHub (rama main)
    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Actualizar galería de ${seccionActual} desde panel admin`,
        content: btoa(unescape(encodeURIComponent(contenidoJson))),
        sha: sha || undefined,
        branch: "main"
      })
    });

    if (putRes.ok) {
      alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-green-100 text-green-800";
      alertBox.textContent = "¡Cambios publicados exitosamente en GitHub!";
    } else {
      throw new Error(`GitHub API Error: ${putRes.status}`);
    }
  } catch (err) {
    console.error("Error al publicar:", err);
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