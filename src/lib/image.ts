/**
 * اختيار صورة من الجهاز وتصغيرها قبل التخزين.
 * الصور تُحفظ كـ data URL في مساحة المتصفح المحلية، فلا ترفع إلى أي خادم؛
 * ولأن تلك المساحة محدودة (حوالي 5 ميغابايت) يجري التصغير قبل الحفظ.
 */
export async function pickImage(maxSide: number, quality = 0.82): Promise<string | null> {
  const file = await chooseFile();
  if (!file) return null;
  return downscale(file, maxSide, quality);
}

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // إن ألغى المستخدم الاختيار لا يُطلق أي حدث في بعض المتصفحات،
    // فنترك الوعد معلّقاً بلا ضرر بدل تسريب مؤقّت.
    input.click();
  });
}

async function downscale(file: File, maxSide: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر تجهيز الصورة");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/** متوسط ألوان الصورة — يولّد تدرّجاً يناسبها لبطاقة المنشور. */
export function gradientFromImage(dataUrl: string): Promise<[string, string, string]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 3;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(["#4C63FF", "#8b5cf6", "#FF6CBA"]);
      ctx.drawImage(img, 0, 0, 3, 1);
      const { data } = ctx.getImageData(0, 0, 3, 1);
      const hex = (i: number) =>
        "#" +
        [data[i], data[i + 1], data[i + 2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      resolve([hex(0), hex(4), hex(8)]);
    };
    img.onerror = () => resolve(["#4C63FF", "#8b5cf6", "#FF6CBA"]);
    img.src = dataUrl;
  });
}
