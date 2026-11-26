export async function prepareImage(file) {

  if (!file) return "";

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Please select a JPG, PNG or WEBP image.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image is too large.");
  }

  const image = new Image();
  const url = URL.createObjectURL(file);

  try {

    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");

    const scale = Math.min(
      1,
      600 / Math.max(image.width, image.height)
    );

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      image, 0, 0,
      canvas.width, canvas.height
    );

    const result = canvas.toDataURL("image/jpeg", 0.6);

    if (result.length > 200000) {
      throw new Error("Please choose a smaller image.");
    }

    return result;

  } finally {
    URL.revokeObjectURL(url);
  }
}