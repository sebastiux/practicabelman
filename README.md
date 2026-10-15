# Seek & Bellman · El Mundo del Wumpus (edición Metallica)

Juego web del **Mundo del Wumpus** con temática de Metallica que resuelve la práctica de Aprendizaje Reforzado con la
**Ecuación de Optimalidad de Bellman (V\*)** por iteración de valores, en una rejilla de 10 × 10.

[![GitHub Pages](https://github.com/sebastiux/practicabelman/actions/workflows/pages.yml/badge.svg)](https://github.com/sebastiux/practicabelman/actions/workflows/pages.yml)

**Juega aquí:** https://sebastiux.github.io/practicabelman/

Cinco escenarios, uno por disco y con dificultad creciente (la ruta segura más corta pasa de 18 a 26 pasos):

| Nivel | Disco | Wumpus | Pozos | Modo Bellman |
|---:|---|---|---|---|
| 1 | Kill 'Em All (1983) | El Jinete | Charcos de sangre | *Seek & Bellman* |
| 2 | Ride the Lightning (1984) | Creeping Death | Sillas eléctricas | *For Whom the Bellman Tolls* |
| 3 | Master of Puppets (1986) | El Titiritero | Tumbas | *Master of Policies* |
| 4 | ...And Justice for All (1988) | La Justicia rota | Minas terrestres | *...And Bellman for All* |
| 5 | Metallica / The Black Album (1991) | La Serpiente | Agujeros negros | *Enter Bellman* |

## Cómo jugar y aprender Bellman (guía paso a paso)

Esta guía es para cualquier estudiante que quiera entender la Ecuación de Optimalidad de Bellman jugando. No necesitas
instalar nada: abre el enlace en una computadora (también funciona en el celular).

### 1. Las reglas del mundo (el MDP)

- Eres un integrante de la banda y empiezas en el amplificador, **S0,0** (esquina inferior izquierda). La meta es la
  **púa de oro en S9,9** (esquina superior derecha).
- Cada estado es una celda **S_x,y** (x = columna, y = fila). Las acciones son **Norte, Sur, Este y Oeste**.
- Recompensas: cada paso a una celda vacía cuesta **−1**; chocar con el borde cuesta **−2** y no te mueves; caer en un
  pozo o toparte con un Wumpus vale **−100** y termina el juego; llegar al oro vale **+100** y ganas.
- El descuento es **γ = 0.9**: una recompensa que llega dentro de t pasos vale γ^t veces su valor. Por eso el oro "vale
  menos" mientras más tardes en llegar.

### 2. Juega tú primero (pestaña *Jugar*)

1. Elige un disco arriba. Empieza por **Kill 'Em All** (nivel 1).
2. Elige a tu integrante y muévete con las **flechas**, **WASD** o el control en pantalla. **R** reinicia.
3. Hay niebla: sólo ves las celdas que ya visitaste. Usa las percepciones para deducir dónde está el peligro:
   **hedor** = hay un Wumpus al lado, **viento** = hay un pozo al lado, **brillo** = el oro está al lado.
4. Mira el marcador: **Σ r** es la suma simple de recompensas y **G = Σ γ^t r** es la ganancia descontada, la cantidad
   que el agente quiere maximizar.
5. Al terminar, compara tu **G** con **V\*(S0,0)**, el valor óptimo que calcula Bellman. Si tu G es menor es porque diste
   pasos de más o te arriesgaste.
6. Activa **Consejo de Bellman** para ver en tu celda la flecha de la política óptima π\*, y **Revelar el mapa** para
   ver todos los peligros.

### 3. Mira cómo piensa Bellman (pestaña *Bellman (IA)*)

1. Empiezas en **k = 0**: todos los valores valen V₀ = 0.
2. Presiona **▶** (siguiente iteración) una vez. En **k = 1** sólo los vecinos del oro se vuelven dorados (valen 100);
   el resto vale −1, el costo de un paso.
3. Haz clic en una celda vecina del oro, por ejemplo **S9,8**. El **Inspector de Bellman** muestra el cálculo de cada
   acción: Q(S9,8, N) = 100 + 0.9·0 = 100, y V₁ es el máximo de las cuatro.
4. Avanza a **k = 2, 3, …**: la zona dorada crece **una celda por iteración**. Una celda a dos pasos vale
   −1 + 0.9·100 = 89; a tres pasos, −1 + 0.9·89 = 79.1. El cambio máximo ΔV_k sigue la serie 100, 90, 81… = 100·0.9^(k−1).
5. Haz clic en **S0,0** y avanza. Mientras el oro no llega, su valor sólo acumula costo de vida (−1, −1.9, −2.71…). En
   la iteración k = d (la longitud de su ruta segura más corta) **salta** a su valor final.
6. Presiona **Iterar Bellman** para animar todo y observa la gráfica de **Convergencia**: ΔV baja y en la última
   iteración vale 0 < ε, así que el algoritmo se detiene.
7. Las **flechas** son la política greedy de cada iteración. Varias flechas pequeñas en una celda = empate.
8. Presiona **Tocar π\***: el agente sigue la política óptima y su ganancia **G coincide con V\*(S0,0)**.
9. Experimenta en **Parámetros del MDP**:
   - Con **γ = 0.99** el agente valora mucho el futuro y V\*(S0,0) sube a 68.6 en el nivel 1.
   - Con **γ = 0.5** el oro lejano casi no pesa y V\*(S0,0) baja a −2.0.
   - Con **resbalón = 0.2** (MDP estocástico) moverse cerca de los peligros es tan riesgoso que la política óptima
     prefiere quedarse en zonas seguras en lugar de ir por el oro.

### 4. Lee la explicación (pestaña *Explicación*)

Desarrolla los resultados paso a paso con los números del mapa elegido: definición del MDP, iteraciones 1 y 2 desglosadas,
la onda de valor, la convergencia, V\* y π\*, la verificación del punto fijo, la trayectoria óptima y la fórmula cerrada
V\*(s) = −10 + 110·0.9^(d(s)−1).

### 5. Ejercicios para comprobar que lo entendiste

1. Calcula a mano V₁ y V₂ de una celda y verifícalos con el inspector.
2. Cuenta en el mapa los pasos d de la entrada al oro y predice V\*(S0,0) = −10 + 110·0.9^(d−1). Compáralo con la app.
3. En *...And Justice for All* V\*(S0,0) es negativo. ¿Por qué aun así conviene ir al oro? (Pista: ¿cuánto vale vagar
   para siempre?)
4. Con resbalón 0.2, ¿qué celdas cambian de flecha y por qué?

## Detalles de implementación

| | |
|---|---|
| Estados | 100 celdas S0,0 … S9,9 |
| Acciones | Norte, Sur, Este, Oeste |
| Meta | S9,9 (oro), r = +100, terminal |
| Peligros | 20 pozos + 5 Wumpus aleatorios (semilla por disco), r = −100, terminales |
| Costo de vida | r = −1 por movimiento a celda vacía |
| Fronteras | salir de la red deja al agente en s con r = −2 |
| γ / ε | 0.9 / 10⁻⁴ (iterar hasta ΔV < ε) |

El núcleo es TypeScript puro y probado: `src/core/mdp.ts` (modelo P(s′,r|s,a)), `src/core/valueIteration.ts`
(Bellman, iteración de valores, política greedy, trayectorias) y `src/core/explain.ts` (datos de la explicación).
[RESULTADOS.md](./RESULTADOS.md) contiene la explicación de resultados como documento estático (`npm run report`) y
[`reporte/`](./reporte) el reporte en LaTeX con sus figuras.

```bash
npm install
npm run dev       # servidor local
npm test          # pruebas (Vitest)
npm run build     # typecheck + build de producción en dist/
npm run report    # regenera RESULTADOS.md
```

Stack: Vite 8 · React 19 · TypeScript · KaTeX · Vitest. Sprites pixel-art originales generados como SVG a partir de
texto (`src/sprites`) y efectos de sonido sintetizados con Web Audio (`src/audio/sfx.ts`).

### Despliegue

`.github/workflows/pages.yml` corre pruebas y build en cada push y publica automáticamente en GitHub Pages en cada push a
`main`. Requisito único: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

---

Proyecto académico hecho por fans, sin afiliación con Metallica. Los sprites son pixel-art original y sólo se mencionan
títulos de discos y canciones.
