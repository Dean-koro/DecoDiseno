const SECCIONES = {
  cortinas: { jsonFile: "../content/galeria-cortinas.json", githubPath: "public/content/galeria-cortinas.json" },
  tapiceria_mobi: { jsonFile: "../content/galeria-tapiceria-mobi.json", githubPath: "public/content/galeria-tapiceria-mobi.json" },
  toldos: { jsonFile: "../content/galeria-toldos.json", githubPath: "public/content/galeria-toldos.json" },
  tapiceria_auto: { jsonFile: "../content/galeria-tapiceria-auto.json", githubPath: "public/content/galeria-tapiceria-auto.json" },
  tapiceria_nautica: { jsonFile: "../content/galeria-tapiceria-nautica.json", githubPath: "public/content/galeria-tapiceria-nautica.json" },
  tapiceria_exterior: { jsonFile: "../content/galeria-exterior.json", githubPath: "public/content/galeria-exterior.json" }
};
const ADMIN_GITHUB_LOGIN = "bot-DecoDiseno";

let listaImagenes = [];
let seccionActual = "cortinas";
let cropperInstance = null;
let indiceEncuadre = null;
let indiceAEliminar = null;

// Inicialización de Listeners de Eventos DOM
document.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.getElementById("loginGitHubBtn");
  const loginScreen = document.getElementById("loginScreen");
  const loginError = document.getElementById("loginError");
  const app = document.getElementById("app");

  const mostrarLogin = (mensaje = "") => {
    loginScreen.classList.remove("hidden");
    app.classList.add("hidden");
    loginError.textContent = mensaje;
    loginError.classList.toggle("hidden", !mensaje);
  };

  const mostrarApp = () => {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    document.getElementById("sectionSelect").addEventListener("change", (e) => cargarGaleria(e.target.value));
    document.getElementById("saveBtn").addEventListener("click", guardarDirectoEnGitHub);
    document.getElementById("cancelCropBtn").addEventListener("click", cerrarModalEncuadre);
    document.getElementById("applyCropBtn").addEventListener("click", aplicarEncuadre);
    document.getElementById("cancelDeleteBtn").addEventListener("click", cerrarModalBorrado);
    document.getElementById("confirmDeleteBtn").addEventListener("click", confirmarEliminacion);
    cargarGaleria("cortinas");
  };

  const esAdministrador = (usuario) => {
    const login = usuario?.login || usuario?.username;
    return login === ADMIN_GITHUB_LOGIN;
  };

  const rechazarSesion = async (authManager) => {
    await authManager?.logout?.();
    mostrarLogin(`Solo la cuenta de GitHub ${ADMIN_GITHUB_LOGIN} tiene acceso.`);
  };

  const obtenerAuthManager = () => {
    const backend = window.CMS?.getBackend?.();
    return backend?.authManager;
  };

  const iniciarSesion = async () => {
    const authManager = obtenerAuthManager();
    if (!authManager) {
      mostrarLogin("No se pudo cargar el servicio de autenticación. Recarga la página.");
      return;
    }

    loginButton.disabled = true;
    loginButton.querySelector("span").textContent = "Conectando con GitHub...";
    try {
      const resultado = await authManager.authenticate({ provider: "github" });
      const usuario = resultado?.user || await authManager.currentUser?.();
      if (!esAdministrador(usuario)) {
        await rechazarSesion(authManager);
        return;
      }
      mostrarApp();
    } catch (error) {
      console.error("Error de autenticación:", error);
      mostrarLogin("No se pudo iniciar sesión con GitHub.");
      loginButton.disabled = false;
      loginButton.querySelector("span").textContent = "Iniciar Sesión con GitHub";
    }
  };

  loginButton.addEventListener("click", iniciarSesion);

  const comprobarSesion = async () => {
    const authManager = obtenerAuthManager();
    try {
      const usuario = await authManager?.currentUser?.();
      if (esAdministrador(usuario)) mostrarApp();
      else if (usuario) await rechazarSesion(authManager);
      else mostrarLogin();
    } catch (error) {
      console.error("Error al comprobar la sesión:", error);
      mostrarLogin();
    }
  };

  comprobarSesion();
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

    // Botones superior (mover / solicitar eliminación)
    const topBar = document.createElement("div");
    topBar.className = "flex justify-between items-center";

    const navGroup = document.createElement("div");
    navGroup.className = "flex gap-1";

    if (index > 0) {
      const prevBtn = crearBotonControl("←", () => moverImagen(index, -1));
      navGroup.appendChild(prevBtn);
    }
    if (index < listaImagenes.length - 1) {
      const nextBtn = crearBotonControl("→", () => moverImagen(index, 1));
      navGroup.appendChild(nextBtn);
    }

    const deleteBtn = crearBotonControl("✕", () => solicitarEliminacion(index), "bg-red-600/80 hover:bg-red-600");
    topBar.appendChild(navGroup);
    topBar.appendChild(deleteBtn);

    // Botón ajustar encuadre
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

// --- Lógica del Modal de Confirmación de Borrado ---
function solicitarEliminacion(index) {
  indiceAEliminar = index;
  document.getElementById("deleteModal").classList.remove("hidden");
}

function cerrarModalBorrado() {
  indiceAEliminar = null;
  document.getElementById("deleteModal").classList.add("hidden");
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
  document.getElementById("cropModal").classList.add("hidden");
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

  btn.disabled = true;
  btn.innerText = "Publicando cambios...";
  alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-blue-100 text-blue-800";
  alertBox.textContent = "Enviando actualización a GitHub...";
  alertBox.classList.remove("hidden");

  const configSeccion = SECCIONES[seccionActual];
  const contenidoJson = JSON.stringify({ imagenes: listaImagenes }, null, 2);

  try {
    if (window.CMS && typeof window.CMS.getBackend === 'function') {
      const backend = window.CMS.getBackend();
      if (backend && backend.persistEntry) {
        await backend.persistEntry({
          path: configSeccion.githubPath,
          data: contenidoJson,
          slug: seccionActual,
          raw: contenidoJson
        });

        alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-green-100 text-green-800";
        alertBox.textContent = "¡Cambios publicados exitosamente en GitHub!";
      } else {
        descargarJsonFallback(contenidoJson, configSeccion.githubPath);
      }
    } else {
      descargarJsonFallback(contenidoJson, configSeccion.githubPath);
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
  const nombreArchivo = rutaArchivo.split('/').pop();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
  
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", nombreArchivo);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  alertBox.className = "mb-6 p-4 rounded-xl font-medium text-sm bg-amber-100 text-amber-800";
  alertBox.innerHTML = `No hay sesión activa de GitHub. Se ha descargado <strong>${nombreArchivo}</strong> para guardar en <code>${rutaArchivo}</code>.`;
}