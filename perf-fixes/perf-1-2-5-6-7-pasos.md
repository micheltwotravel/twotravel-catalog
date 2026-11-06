# PERF-1, 2, 5, 6, 7 — Pasos exactos en WordPress + GTM

## PERF-1: Eliminar trackers duplicados (Ray · ~30 min)

### En Site Kit (WordPress admin → Site Kit → Configuración)
- [ ] Desactivar "Colocar la etiqueta de Google en el sitio" — mantener solo Search Console y Analytics reporting
- [ ] Mantener Search Console conectado ✓

### En WordPress → Plugins
- [ ] Desactivar **TikTok for Business** plugin (el pixel quedará en GTM)

### En Tag Manager (GTM-TKWR25T)
- [ ] Verificar que estos tags existan y disparen 1× sola:
  - Google Analytics 4 (en trigger: Initialization)
  - Google Ads (602800882)
  - Meta Pixel
  - TikTok Pixel
  - HubSpot (puede quedar en plugin si se usa el chat/forms)
- [ ] Si alguno de esos está duplicado, pausar/eliminar el duplicado

### Verificación
- [ ] Abrir Tag Assistant → https://two.travel → confirmar que cada tag dispara exactamente 1×
- [ ] Abrir Meta Pixel Helper → confirmar 1 disparo
- [ ] Abrir TikTok Pixel Helper → confirmar 1 disparo
- [ ] Crear una conversión de prueba para confirmar que Ads sigue registrando


---

## PERF-2: Delay de scripts hasta interacción (Ray · ~20 min)

### En WordPress → FlyingPress → Delay JavaScript
- [ ] Activar "Delay JavaScript execution"
- [ ] Agregar a la lista de scripts a delay (uno por línea):
  ```
  fbevents.js
  tiktok
  hs-scripts.com
  trustindex
  click-to-chat
  ```
- [ ] ⚠️ **NO agregar gtm.js** a la lista — rompe conversiones de Ads para visitantes que no interactúan

### En Tag Manager (GTM-TKWR25T)
- [ ] Meta Pixel tag → cambiar trigger de **Page View** → **Window Loaded**
- [ ] TikTok Pixel tag → cambiar trigger de **Page View** → **Window Loaded**
- [ ] Ads Remarketing tag → cambiar trigger de **Page View** → **Window Loaded**
- [ ] Google Analytics 4 → mantener en **Initialization** (no cambiar)

### Verificación
- [ ] Correr PageSpeed Insights móvil en https://two.travel → TBT debe bajar de 1,880ms
- [ ] Probar WhatsApp button, HubSpot chat y formularios → deben seguir funcionando después del primer scroll/clic
- [ ] Confirmar en GA4 que siguen llegando pageviews


---

## PERF-5: Reducir peso de Elementor (Samuel · ~1 hora)

### En WordPress → Elementor → Performance (menú superior)
- [ ] Activar "Optimized asset loading" (carga solo los assets de widgets usados en cada página)
- [ ] Activar "Element caching"
- [ ] CSS Print Method → cambiar de **Internal Embedding** → **External File**

### En FlyingPress → CSS
- [ ] Activar "Remove unused CSS"
- [ ] Activar "Self-host Google Fonts" + font-display: swap

### Exclusive Addons for Elementor
- [ ] Revisar qué widgets de Exclusive Addons se usan en la homepage
- [ ] Si son ≤ 3 widgets, considerar reemplazarlos con Elementor Pro nativo y remover el plugin

### Homepage
- [ ] Revisar secciones duplicadas mobile/desktop ocultas (hay 1,524 elementos hoy, meta < 1,200)
- [ ] Eliminar secciones hidden que no se usan

### Verificación
- [ ] PageSpeed → revisar que stylesheets bajaron de 30 a < 15


---

## PERF-6: Tag governance (Ray · ~15 min)

### En Tag Manager (GTM-TKWR25T) → Admin
- [ ] Admin → Container → User Management
  - Ray = Publishing + Edit
  - Resto del equipo = Edit only (sin Publishing)
- [ ] Crear un tag Register en Notion o Google Sheets con columnas:
  | Tag | Propósito | Owner | Trigger | Fecha agregado | Fecha expiración |
  |-----|-----------|-------|---------|----------------|-----------------|
  | GA4 | Analytics | Ray | Init | oct 2024 | - |
  | Meta Pixel | Ads | Ray | Win Loaded | oct 2024 | - |
  | TikTok | Ads | Ray | Win Loaded | oct 2024 | - |
  | Google Ads | Conversiones | Ray | Win Loaded | oct 2024 | - |

### Regla documentada
- Ningún código de tracking fuera de GTM o HubSpot plugin
- Nuevos marketing tags → trigger Window Loaded por defecto
- Revisión trimestral: eliminar tags de campañas vencidas


---

## PERF-7: Proceso seguro de actualizaciones (Ray · ~30 min)

### Después de completar PERF-1 a 5
- [ ] FlyingPress → Export Settings → guardar el JSON con este doc
- [ ] GTM → Admin → Export Container → guardar el JSON con este doc

### En WordPress → Configuración de actualizaciones
- [ ] Desactivar auto-updates para estos plugins:
  - Elementor
  - Elementor Pro
  - FlyingPress
  - Google Site Kit
  - HubSpot
  - TikTok for Business (si se reactiva algún día)

### Reglas para todo el equipo
- Fotos: máximo 2,000px ancho, formato WebP antes de subir
- Nuevos plugins: correr PageSpeed antes y después de activar
- Updates: probar en staging → PageSpeed → push live si score aguanta

### Checklist de updates (cada vez que se actualiza un plugin crítico)
1. Hacer update en staging
2. Correr PageSpeed móvil en staging
3. Si score >= 75 y TBT < 400ms → push a producción
4. Si no → revertir y abrir issue
