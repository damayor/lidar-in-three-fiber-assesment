# nuScenes FastAPI — Setup en 20 minutos

## Estructura del proyecto

```
nuscenes-api/
├── main.py            # App principal FastAPI
├── config.py          # Settings (lee .env)
├── database.py        # Singleton del SDK nuScenes
├── routers/
│   ├── scenes.py      # GET /scenes/...
│   ├── samples.py     # GET /samples/...
│   └── sensor_data.py # GET /sensor-data/...
├── data/
│   └── nuscenes/      # ← aquí va el dataset
├── .env               # Variables de entorno
└── requirements.txt
```

---

## Paso 1 — Descargar el dataset (mini, 4 GB)

1. Crear cuenta gratis en https://www.nuscenes.org/sign-up
2. Descargar **nuScenes mini** (v1.0-mini):
   - `v1.0-mini.tgz` (metadata)
   - `nuScenes-v1.0-mini.db` no es necesario
   - Imágenes del mini: `v1.0-mini-samples.tgz` y `v1.0-mini-sweeps.tgz`
3. Extraer TODO dentro de `data/nuscenes/`:

```
data/nuscenes/
├── maps/
├── samples/
├── sweeps/
└── v1.0-mini/
    ├── scene.json
    ├── sample.json
    ├── ...
```

---

## Paso 2 — Crear entorno virtual e instalar dependencias

```bash
# Desde la carpeta nuscenes-api/
python -m venv venv

# Activar (Mac/Linux)
source venv/bin/activate

# Activar (Windows)
venv\Scripts\activate

# Instalar
pip install -r requirements.txt
```

> ⚠️ nuscenes-devkit requiere Python 3.8+. Recomendado: Python 3.10

---

## Paso 3 — Configurar .env

Edita `.env` si tu dataset está en otra ruta:

```env
NUSCENES_VERSION=v1.0-mini
NUSCENES_DATAROOT=./data/nuscenes
```

---

## Paso 4 — Levantar el servidor

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Deberías ver:
```
Loading nuScenes v1.0-mini from ./data/nuscenes ...
Loaded 10 scenes and 404 samples.
INFO: Uvicorn running on http://0.0.0.0:8000
```

---

## Paso 5 — Probar con Postman

Importa la siguiente colección o crea requests manualmente:

### Health check
```
GET http://localhost:8000/health
```

### Listar todas las scenes
```
GET http://localhost:8000/scenes
```
Query params opcionales: `?limit=10&offset=0`

### Detalle de una scene (copia un token del paso anterior)
```
GET http://localhost:8000/scenes/{scene_token}
```

### Todos los frames de una scene
```
GET http://localhost:8000/scenes/{scene_token}/samples
```

### Detalle de un frame
```
GET http://localhost:8000/samples/{sample_token}
```

### Anotaciones de un frame
```
GET http://localhost:8000/samples/{sample_token}/annotations
```

### Datos de un sensor específico en un frame
```
GET http://localhost:8000/sensor-data/sample/{sample_token}/channel/CAM_FRONT
```
Canales válidos: `CAM_FRONT`, `CAM_BACK`, `LIDAR_TOP`, `RADAR_FRONT`, etc.

---

## Bonus — Swagger UI (docs automáticas)

Abre en el browser:
```
http://localhost:8000/docs
```
FastAPI genera docs interactivas automáticamente — puedes probar todos los endpoints ahí también.

---

## Flujo típico de un cliente

```
1. GET /scenes                              → elige un scene_token
2. GET /scenes/{token}/samples              → elige un sample_token
3. GET /samples/{token}                     → ve sensores disponibles
4. GET /sensor-data/sample/{token}/channel/CAM_FRONT  → datos de cámara
```
