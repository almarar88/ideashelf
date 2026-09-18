#!/usr/bin/env bash
# ينشئ مفتاح توقيع الإصدار لمتجر جوجل بلاي ويجهّز keystore.properties.
# شغّله مرة واحدة فقط، واحتفظ بالمفتاح وكلمات المرور في مكان آمن:
# فقدان هذا المفتاح يعني عدم القدرة على رفع تحديثات لاحقة إن لم تُفعّل «توقيع تطبيقات Play».

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_PATH="$ROOT_DIR/mahami-release.jks"
ALIAS="mahami"

if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "المفتاح موجود بالفعل: $KEYSTORE_PATH"
  exit 1
fi

read -rsp "كلمة مرور المفتاح (احفظها جيداً): " STORE_PASS; echo
read -rsp "أعد كتابة كلمة المرور: " STORE_PASS_CONFIRM; echo
if [[ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]]; then
  echo "كلمتا المرور غير متطابقتين."
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
  -dname "CN=Mahami, OU=Mobile, O=Mahami, L=, S=, C=AE"

cat > "$ROOT_DIR/keystore.properties" <<PROPS
storeFile=mahami-release.jks
storePassword=$STORE_PASS
keyAlias=$ALIAS
keyPassword=$STORE_PASS
PROPS

chmod 600 "$ROOT_DIR/keystore.properties"

echo
echo "تم إنشاء المفتاح: $KEYSTORE_PATH"
echo "وتم إنشاء: $ROOT_DIR/keystore.properties"
echo "الملفان مستثنيان من Git ولا يجب رفعهما إلى المستودع."
echo
echo "لبناء حزمة المتجر:  gradle :app:bundleRelease"
echo "الناتج: app/build/outputs/bundle/release/app-release.aab"
