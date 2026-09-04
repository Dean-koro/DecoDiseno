document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector('button[aria-label="Menu"]');
  let mobileMenu = null;

  if (menuButton) {
    mobileMenu = document.createElement("nav");
    mobileMenu.className = "mobile-menu hidden";
    mobileMenu.setAttribute("aria-label", "Navegación móvil");
    mobileMenu.innerHTML =
      '<a href="index.html">Inicio</a><a href="proyectos.html">Proyectos</a><a href="contacto.html">Contacto</a>';
    document.body.appendChild(mobileMenu);
    menuButton.setAttribute("aria-expanded", "false");

    const closeMobileMenu = () => {
      mobileMenu.classList.add("hidden");
      menuButton.setAttribute("aria-expanded", "false");
    };

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !mobileMenu.classList.contains("hidden");
      mobileMenu.classList.toggle("hidden", isOpen);
      menuButton.setAttribute("aria-expanded", String(!isOpen));
    });
    mobileMenu.addEventListener("click", closeMobileMenu);
    document.addEventListener("click", (event) => {
      if (!mobileMenu.contains(event.target) && event.target !== menuButton) {
        closeMobileMenu();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileMenu();
    });
  }

  document.querySelector("#scroll-to-form")?.addEventListener("click", () => {
    document.getElementById("formulario")?.scrollIntoView({
      behavior: "smooth",
    });
  });

  const galleryItems = [...document.querySelectorAll(".gallery-item")];
  const projectImages = [
    ...document.querySelectorAll('main img[src^="imagenes/"]'),
  ]
    .filter((image) => !image.classList.contains("gallery-item"));
  const zoomableImages = [...new Set([...galleryItems, ...projectImages])];

  const downloadWithWatermark = (
    imageSource,
    filename = "imagen-decodiseno.jpg",
  ) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);

      const fontSize = Math.max(canvas.width / 18, 24);
      context.font = `bold ${fontSize}px sans-serif`;
      context.fillStyle = "rgba(255, 255, 255, 0.45)";
      context.strokeStyle = "rgba(0, 0, 0, 0.35)";
      context.lineWidth = 2;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(-Math.PI / 6);

      const stepX = fontSize * 8;
      const stepY = fontSize * 4;
      const limit = Math.max(canvas.width, canvas.height) * 1.5;
      for (let x = -limit; x < limit; x += stepX) {
        for (let y = -limit; y < limit; y += stepY) {
          context.strokeText("DECO DISEÑO", x, y);
          context.fillText("DECO DISEÑO", x, y);
        }
      }
      context.restore();

      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/jpeg", 0.9);
      link.click();
    };
    image.src = imageSource;
  };

  document.addEventListener("contextmenu", (event) => {
    const image = event.target.closest(
      ".gallery-item, .gallery-overlay-image, #lightbox-img",
    );
    if (!image) return;
    event.preventDefault();
    downloadWithWatermark(image.currentSrc || image.src);
  });

  document.querySelectorAll('[id^="galleryTrack"]').forEach((track) => {
    const wrapper = track.closest("section") || track.parentElement;
    const previous = wrapper.querySelector('[id^="prevGallery"]');
    const next = wrapper.querySelector('[id^="nextGallery"]');
    const getScrollAmount = () => Math.max(track.clientWidth * 0.8, 280);
    previous?.addEventListener(
      "click",
      () => track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" }),
    );
    next?.addEventListener(
      "click",
      () => track.scrollBy({ left: getScrollAmount(), behavior: "smooth" }),
    );
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScrollLeft = 0;
    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startScrollLeft = track.scrollLeft;
      track.classList.add("cursor-grabbing", "select-none");
    });
    track.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerType !== "mouse") return;
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 6) moved = true;
      track.scrollLeft = startScrollLeft - distance;
    });
    track.addEventListener("click", (event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    const stopDragging = () => {
      dragging = false;
      track.classList.remove("cursor-grabbing", "select-none");
    };
    track.addEventListener("pointerup", stopDragging);
    track.addEventListener("pointercancel", stopDragging);
    track.addEventListener("pointerleave", stopDragging);
  });

  let galleryOverlay = document.getElementById("galleryOverlay");
  let galleryOverlayContent = document.getElementById("galleryOverlayContent");
  if (!galleryOverlay && zoomableImages.length) {
    galleryOverlay = document.createElement("div");
    galleryOverlay.id = "galleryOverlay";
    galleryOverlay.className =
      "hidden fixed inset-0 z-[100] bg-[#111827]/70 items-center justify-center p-8 backdrop-blur-md [&.active]:flex";
    galleryOverlay.setAttribute("aria-hidden", "true");
    galleryOverlay.innerHTML =
      '<div class="relative w-[min(900px,90vw)] max-h-[85vh] bg-white/95 border border-white/30 rounded-3xl overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.28)] animate-modalIn"><button class="gallery-overlay-close absolute top-4 right-4 z-[2] w-10 h-10 rounded-full border border-[#181e29]/15 bg-white/80 text-gray-800 text-2xl leading-none cursor-pointer" type="button" aria-label="Cerrar vista ampliada">×</button><div id="galleryOverlayContent" class="w-full min-h-[420px] flex items-center justify-center bg-gradient-to-br from-[#f7f2ea] to-[#dfe5d8] text-[#181e29]/70 text-[clamp(0.75rem,1vw,1rem)] font-semibold tracking-[0.22em] uppercase p-8 text-center"></div></div>';
    document.body.appendChild(galleryOverlay);
    galleryOverlayContent = galleryOverlay.querySelector(
      "#galleryOverlayContent",
    );
  }

  if (galleryOverlay && galleryOverlayContent) {
    galleryOverlayContent.classList.add("gallery-overlay-content");
  }

  let currentImage = null;
  const openGalleryImage = (image) => {
    if (!galleryOverlay || !galleryOverlayContent) return;
    currentImage = image;
    galleryOverlayContent.innerHTML = "";
    const enlargedImage = document.createElement("img");
    enlargedImage.src = image.currentSrc || image.src;
    enlargedImage.alt = image.alt;
    enlargedImage.className = "gallery-overlay-image";
    galleryOverlayContent.appendChild(enlargedImage);
    galleryOverlay.classList.remove("hidden");
    galleryOverlay.classList.add("active", "flex");
    galleryOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-open");
  };
  const closeGalleryImage = () => {
    galleryOverlay?.classList.remove("active");
    galleryOverlay?.classList.remove("flex");
    galleryOverlay?.classList.add("hidden");
    galleryOverlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gallery-open");
  };

  zoomableImages.forEach((image) => {
    let startX = 0;
    let startY = 0;
    image.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
    });
    image.addEventListener("pointerup", (event) => {
      if (event.button !== 0) return;
      const distance = Math.hypot(
        event.clientX - startX,
        event.clientY - startY,
      );
      if (distance <= 6) openGalleryImage(image);
    });
  });
  galleryOverlay?.querySelector(".gallery-overlay-close")?.addEventListener(
    "click",
    closeGalleryImage,
  );
  galleryOverlay?.addEventListener("click", (event) => {
    if (event.target === galleryOverlay) closeGalleryImage();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" && galleryOverlay?.classList.contains("active")
    ) closeGalleryImage();
  });

  window.closeLightbox = () => {
    const lightbox = document.getElementById("lightbox");
    lightbox?.classList.add("hidden");
    lightbox?.classList.remove("flex");
  };
  document.querySelector("#lightbox-close")?.addEventListener(
    "click",
    window.closeLightbox,
  );
});
