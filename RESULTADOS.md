# Resultados de la práctica: Mundo del Wumpus con la Ecuación de Optimalidad de Bellman

> Documento generado con `npm run report` (scripts/report.ts) usando exactamente el mismo código que el juego (`src/core`).
> La versión interactiva, con la misma explicación calculada en vivo para cualquier disco o mapa, está en la pestaña **Explicación** del juego.

## Enunciado (ejercicio de la práctica)

Implementar la **Ecuación de Optimalidad de Bellman (V\*)** para encontrar la política óptima de navegación en un ambiente de 10 × 10. El agente debe aprender a navegar en el *Mundo del Wumpus*, maximizando la ganancia acumulada y evitando estados terminales negativos.

| Elemento | Definición del MDP |
|---|---|
| Estados S | 100 celdas, S0,0 … S9,9 (x = columna, y = fila; S0,0 abajo a la izquierda) |
| Acciones A | Norte, Sur, Este, Oeste (un paso Manhattan) |
| Estado meta | S9,9 (oro) con r = +100, terminal |
| Peligros | 20 pozos y 5 Wumpus distribuidos aleatoriamente, r = −100, terminales |
| Costo de vida | r = −1 por cada movimiento a una celda vacía |
| Fronteras | si la acción saca al agente de la red, permanece en s con r = −2 |
| Descuento | γ = 0.9 |
| Convergencia | iterar hasta que ΔV < ε (ε = 10⁻⁴) |
| Transiciones | deterministas: P(s′, r \| s, a) = 1 para el único s′ al que lleva a |

Cada disco es un escenario distinto (semilla fija, dificultad creciente) con la misma definición del MDP; el juego también permite generar mapas aleatorios. Se garantiza que siempre exista un camino seguro de la entrada al oro.

## Ecuación y algoritmo

$$V_*(s) = \max_a \sum_{s',r} P(s',r \mid s,a)\,[r + \gamma V_*(s')]$$

Con transiciones deterministas la suma desaparece: $V_*(s) = \max_a [\,r(s,a) + 0.9\,V_*(s')\,]$, con V = 0 en los estados terminales. La **iteración de valores** la convierte en una regla de actualización síncrona:

$$V_{k+1}(s) = \max_a \sum_{s',r} P(s',r \mid s,a)\,[r + \gamma V_k(s')], \qquad \Delta V_{k+1} = \max_s |V_{k+1}(s) - V_k(s)|$$

```
V ← 0 para todos los estados
repetir
    V' ← V
    para cada estado no terminal s:
        V'(s) ← max_a Σ P(s',r|s,a)·[r + γ·V(s')]
    Δ ← max_s |V'(s) − V(s)|
    V ← V'
hasta que Δ < ε
π*(s) ← argmax_a Σ P(s',r|s,a)·[r + γ·V(s')]
```

Implementación: `src/core/valueIteration.ts` (`backup`, `bellmanSweep`, `valueIteration`, `greedyPolicy`) y modelo del MDP en `src/core/mdp.ts`.

## Resumen de los 5 escenarios

| Nivel | Disco | Semilla | d(S0,0) | d_max | Iteraciones K | V*(S0,0) | Residual de Bellman |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | Kill 'Em All | 1 | 18 | 26 | 27 | 8.3449 | 0.0e+0 |
| 2 | Ride the Lightning | 1109 | 20 | 28 | 29 | 4.8594 | 0.0e+0 |
| 3 | Master of Puppets | 6942 | 22 | 26 | 27 | 2.0361 | 0.0e+0 |
| 4 | ...And Justice for All | 21491 | 24 | 30 | 31 | -0.2508 | 0.0e+0 |
| 5 | Metallica (The Black Album) | 13782 | 26 | 30 | 31 | -2.1031 | 0.0e+0 |

En todos los mapas la iteración de valores converge exactamente en d_max + 1 barridos, el residual de Bellman es 0 (V\* es punto fijo de la ecuación) y π\* lleva de S0,0 al oro por la ruta segura más corta.

## Nivel 1 · Kill 'Em All (1983) — explicación detallada

Mapa con semilla **1**: 20 charcos de sangre (pozos, 🕳️), 5 × El Jinete (Wumpus, 👹), la entrada 🎸 en S0,0 y la púa de oro 🏆 en S9,9. Quedan **74 estados no terminales**; los 26 terminales valen 0.

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | · | · | 🕳️ | 👹 | · | · | 🕳️ | · | · | 🏆 |
| **8** | · | · | 🕳️ | · | · | · | · | 🕳️ | · | · |
| **7** | · | 🕳️ | · | 🕳️ | · | · | · | · | · | · |
| **6** | · | 👹 | · | · | · | · | · | · | 🕳️ | · |
| **5** | · | · | 🕳️ | · | · | 👹 | · | 🕳️ | · | · |
| **4** | · | · | · | 🕳️ | 🕳️ | · | · | 🕳️ | · | · |
| **3** | · | 👹 | 👹 | · | 🕳️ | 🕳️ | 🕳️ | · | · | · |
| **2** | · | · | 🕳️ | · | · | · | 🕳️ | · | 🕳️ | · |
| **1** | · | · | · | · | · | · | · | · | · | · |
| **0** | 🎸 | · | · | · | · | 🕳️ | 🕳️ | · | · | · |

### Paso 1 · Inicialización (k = 0)
V₀(s) = 0 para los 100 estados. Con esto, en la primera iteración el término γ·V₀(s′) vale 0.

### Paso 2 · Iteración 1: sólo cuentan las recompensas inmediatas

**S9,8, iteración k = 1.** Vecino del oro: ir hacia S9,9 vale 100 + 0.9·0 = 100.

| a | s′ | r | V0(s′) | r + γ·V0(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S9,9 | 100 | 0.00 | **100.00** |
| ↓ Sur | S9,7 | -1 | 0.00 | -1.00 |
| → Este | S9,8 (borde) | -2 | 0.00 | -2.00 |
| ← Oeste | S8,8 | -1 | 0.00 | -1.00 |

```
Q(S9,8,N) = 100 + 0.9·(0.00) = 100.00
Q(S9,8,S) = -1 + 0.9·(0.00) = -1.00
Q(S9,8,E) = -2 + 0.9·(0.00) = -2.00
Q(S9,8,O) = -1 + 0.9·(0.00) = -1.00
V1(S9,8) = max{100.00, -1.00, -2.00, -1.00} = 100.00
```

**S2,1, iteración k = 1.** Junto a un peligro: entrar vale -100, chocar -2, moverse a una celda vacía -1. Gana moverse y todavía no sabe nada del oro.

| a | s′ | r | V0(s′) | r + γ·V0(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S2,2 | -100 | 0.00 | -100.00 |
| ↓ Sur | S2,0 | -1 | 0.00 | **-1.00** |
| → Este | S3,1 | -1 | 0.00 | **-1.00** |
| ← Oeste | S1,1 | -1 | 0.00 | **-1.00** |

```
Q(S2,1,N) = -100 + 0.9·(0.00) = -100.00
Q(S2,1,S) = -1 + 0.9·(0.00) = -1.00
Q(S2,1,E) = -1 + 0.9·(0.00) = -1.00
Q(S2,1,O) = -1 + 0.9·(0.00) = -1.00
V1(S2,1) = max{-100.00, -1.00, -1.00, -1.00} = -1.00
```

**S0,0, iteración k = 1.** La entrada es una esquina: Sur y Oeste chocan con la frontera (-2).

| a | s′ | r | V0(s′) | r + γ·V0(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S0,1 | -1 | 0.00 | **-1.00** |
| ↓ Sur | S0,0 (borde) | -2 | 0.00 | -2.00 |
| → Este | S1,0 | -1 | 0.00 | **-1.00** |
| ← Oeste | S0,0 (borde) | -2 | 0.00 | -2.00 |

```
Q(S0,0,N) = -1 + 0.9·(0.00) = -1.00
Q(S0,0,S) = -2 + 0.9·(0.00) = -2.00
Q(S0,0,E) = -1 + 0.9·(0.00) = -1.00
Q(S0,0,O) = -2 + 0.9·(0.00) = -2.00
V1(S0,0) = max{-1.00, -2.00, -1.00, -2.00} = -1.00
```

Tras la iteración 1 sólo los vecinos del oro valen 100; el resto de los estados vale −1 (el costo de un paso):

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | -1.0 | -1.0 | 🕳️ | 👹 | -1.0 | -1.0 | 🕳️ | -1.0 | 100.0 | 🏆 |
| **8** | -1.0 | -1.0 | 🕳️ | -1.0 | -1.0 | -1.0 | -1.0 | 🕳️ | -1.0 | 100.0 |
| **7** | -1.0 | 🕳️ | -1.0 | 🕳️ | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 |
| **6** | -1.0 | 👹 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | 🕳️ | -1.0 |
| **5** | -1.0 | -1.0 | 🕳️ | -1.0 | -1.0 | 👹 | -1.0 | 🕳️ | -1.0 | -1.0 |
| **4** | -1.0 | -1.0 | -1.0 | 🕳️ | 🕳️ | -1.0 | -1.0 | 🕳️ | -1.0 | -1.0 |
| **3** | -1.0 | 👹 | 👹 | -1.0 | 🕳️ | 🕳️ | 🕳️ | -1.0 | -1.0 | -1.0 |
| **2** | -1.0 | -1.0 | 🕳️ | -1.0 | -1.0 | -1.0 | 🕳️ | -1.0 | 🕳️ | -1.0 |
| **1** | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 |
| **0** | -1.0 | -1.0 | -1.0 | -1.0 | -1.0 | 🕳️ | 🕳️ | -1.0 | -1.0 | -1.0 |

### Paso 3 · Iteración 2: el oro se propaga una celda más

**S9,7, iteración k = 2.** A dos pasos del oro: su vecino ya vale V₁ = 100, así que -1 + 0.9·100 = 89.

| a | s′ | r | V1(s′) | r + γ·V1(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S9,8 | -1 | 100.00 | **89.00** |
| ↓ Sur | S9,6 | -1 | -1.00 | -1.90 |
| → Este | S9,7 (borde) | -2 | -1.00 | -2.90 |
| ← Oeste | S8,7 | -1 | -1.00 | -1.90 |

```
Q(S9,7,N) = -1 + 0.9·(100.00) = 89.00
Q(S9,7,S) = -1 + 0.9·(-1.00) = -1.90
Q(S9,7,E) = -2 + 0.9·(-1.00) = -2.90
Q(S9,7,O) = -1 + 0.9·(-1.00) = -1.90
V2(S9,7) = max{89.00, -1.90, -2.90, -1.90} = 89.00
```

**S0,0, iteración k = 2.** La entrada sigue lejos: -1 + 0.9·(−1) = −1.9.

| a | s′ | r | V1(s′) | r + γ·V1(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S0,1 | -1 | -1.00 | **-1.90** |
| ↓ Sur | S0,0 (borde) | -2 | -1.00 | -2.90 |
| → Este | S1,0 | -1 | -1.00 | **-1.90** |
| ← Oeste | S0,0 (borde) | -2 | -1.00 | -2.90 |

```
Q(S0,0,N) = -1 + 0.9·(-1.00) = -1.90
Q(S0,0,S) = -2 + 0.9·(-1.00) = -2.90
Q(S0,0,E) = -1 + 0.9·(-1.00) = -1.90
Q(S0,0,O) = -2 + 0.9·(-1.00) = -2.90
V2(S0,0) = max{-1.90, -2.90, -1.90, -2.90} = -1.90
```

### Paso 4 · La onda de valor y la ley de ΔV

En cada barrido la información del oro avanza **exactamente una celda**: tras k iteraciones la conocen los estados a k pasos o menos. El estado recién alcanzado a distancia k pasa de valer −(1−γ^(k−1))/(1−γ) (vagar) a −(1−γ^(k−1))/(1−γ) + 100·γ^(k−1) (ir al oro), por eso **ΔV_k = 100·γ^(k−1)** mientras la onda avanza.

| k | ΔV_k | 100·γ^(k−1) | estados que ya conocen el oro | ¿ΔV < ε? |
|---:|---:|---:|---:|:---:|
| 1 | 100.0000 | 100.0000 | 2 | no |
| 2 | 90.0000 | 90.0000 | 5 | no |
| 3 | 81.0000 | 81.0000 | 7 | no |
| 4 | 72.9000 | 72.9000 | 9 | no |
| 5 | 65.6100 | 65.6100 | 13 | no |
| 6 | 59.0490 | 59.0490 | 18 | no |
| 7 | 53.1441 | 53.1441 | 24 | no |
| 8 | 47.8297 | 47.8297 | 30 | no |
| 9 | 43.0467 | 43.0467 | 38 | no |
| 10 | 38.7420 | 38.7420 | 42 | no |
| 11 | 34.8678 | 34.8678 | 45 | no |
| 12 | 31.3811 | 31.3811 | 46 | no |
| 13 | 28.2430 | 28.2430 | 48 | no |
| 14 | 25.4187 | 25.4187 | 51 | no |
| 15 | 22.8768 | 22.8768 | 54 | no |
| 16 | 20.5891 | 20.5891 | 57 | no |
| 17 | 18.5302 | 18.5302 | 60 | no |
| 18 | 16.6772 | 16.6772 | 62 | no |
| 19 | 15.0095 | 15.0095 | 63 | no |
| 20 | 13.5085 | 13.5085 | 64 | no |
| 21 | 12.1577 | 12.1577 | 66 | no |
| 22 | 10.9419 | 10.9419 | 69 | no |
| 23 | 9.8477 | 9.8477 | 70 | no |
| 24 | 8.8629 | 8.8629 | 71 | no |
| 25 | 7.9766 | 7.9766 | 73 | no |
| 26 | 7.1790 | 7.1790 | 74 | no |
| 27 | 0.0000 | — | 74 | sí → parar |

### Paso 5 · La entrada se entera del oro (k = 18)

**S0,0, iteración k = 18.** La ruta segura más corta mide d = 18. Hasta la iteración 17 su mejor plan era vagar (V17 = -8.33); en la 18 su vecino sobre la ruta ya trae el valor del oro y salta a su valor definitivo.

| a | s′ | r | V17(s′) | r + γ·V17(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S0,1 | -1 | 10.38 | **8.34** |
| ↓ Sur | S0,0 (borde) | -2 | -8.33 | -9.50 |
| → Este | S1,0 | -1 | 10.38 | **8.34** |
| ← Oeste | S0,0 (borde) | -2 | -8.33 | -9.50 |

```
Q(S0,0,N) = -1 + 0.9·(10.38) = 8.34
Q(S0,0,S) = -2 + 0.9·(-8.33) = -9.50
Q(S0,0,E) = -1 + 0.9·(10.38) = 8.34
Q(S0,0,O) = -2 + 0.9·(-8.33) = -9.50
V18(S0,0) = max{8.34, -9.50, 8.34, -9.50} = 8.34
```

### Paso 6 · Convergencia

El estado más lejano está a d_max = 26 pasos: recibe el valor del oro en la iteración 26 y en la **27** ya nada cambia (ΔV = 0.0000 < ε = 0.0001). En un MDP determinista la iteración de valores termina exactamente en d_max + 1 barridos.

### Paso 7 · Resultado: V* y π*

V* (valor óptimo de cada estado):

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | -1.2 | -2.1 | 🕳️ | 👹 | 37.4 | 42.6 | 🕳️ | 89.0 | 100.0 | 🏆 |
| **8** | -0.3 | -1.2 | 🕳️ | 37.4 | 42.6 | 48.5 | 55.0 | 🕳️ | 89.0 | 100.0 |
| **7** | 0.8 | 🕳️ | 28.4 | 🕳️ | 48.5 | 55.0 | 62.2 | 70.2 | 79.1 | 89.0 |
| **6** | 2.0 | 👹 | 32.6 | 37.4 | 42.6 | 48.5 | 55.0 | 62.2 | 🕳️ | 79.1 |
| **5** | 3.4 | 2.0 | 🕳️ | 32.6 | 37.4 | 👹 | 48.5 | 🕳️ | 62.2 | 70.2 |
| **4** | 4.9 | 3.4 | 2.0 | 🕳️ | 🕳️ | 37.4 | 42.6 | 🕳️ | 55.0 | 62.2 |
| **3** | 6.5 | 👹 | 👹 | 12.6 | 🕳️ | 🕳️ | 🕳️ | 42.6 | 48.5 | 55.0 |
| **2** | 8.3 | 10.4 | 🕳️ | 15.2 | 18.0 | 21.1 | 🕳️ | 37.4 | 🕳️ | 48.5 |
| **1** | 10.4 | 12.6 | 15.2 | 18.0 | 21.1 | 24.5 | 28.4 | 32.6 | 37.4 | 42.6 |
| **0** | 8.3 | 10.4 | 12.6 | 15.2 | 18.0 | 🕳️ | 🕳️ | 28.4 | 32.6 | 37.4 |

π* (acción óptima; dos flechas = empate entre acciones igual de buenas):

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | ↓ | ↓← | 🕳️ | 👹 | ↓→ | ↓ | 🕳️ | → | → | 🏆 |
| **8** | ↓ | ← | 🕳️ | → | ↓→ | ↓→ | ↓ | 🕳️ | ↑→ | ↑ |
| **7** | ↓ | 🕳️ | ↓ | 🕳️ | → | → | → | → | ↑→ | ↑ |
| **6** | ↓ | 👹 | → | → | ↑→ | ↑→ | ↑→ | ↑ | 🕳️ | ↑ |
| **5** | ↓ | ↓← | 🕳️ | ↑→ | ↑ | 👹 | ↑ | 🕳️ | → | ↑ |
| **4** | ↓ | ← | ← | 🕳️ | 🕳️ | → | ↑ | 🕳️ | ↑→ | ↑ |
| **3** | ↓ | 👹 | 👹 | ↓ | 🕳️ | 🕳️ | 🕳️ | → | ↑→ | ↑ |
| **2** | ↓→ | ↓ | 🕳️ | ↓→ | ↓→ | ↓ | 🕳️ | ↑ | 🕳️ | ↑ |
| **1** | → | → | → | → | → | → | → | ↑→ | → | ↑ |
| **0** | ↑→ | ↑→ | ↑→ | ↑→ | ↑ | 🕳️ | 🕳️ | ↑→ | ↑→ | ↑ |

Ninguna flecha apunta a un peligro ni a la frontera: entrar a un pozo o con un Wumpus (-100) o chocar (-2 sin avanzar) siempre es peor que un paso de -1.

### Paso 8 · Verificación: V* es punto fijo de la ecuación

| a | s′ | r | V*(s′) | r + γ·V*(s′) |
|---|---|---:|---:|---:|
| ↑ Norte | S0,1 | -1 | 10.38 | **8.34** |
| ↓ Sur | S0,0 (borde) | -2 | 8.34 | 5.51 |
| → Este | S1,0 | -1 | 10.38 | **8.34** |
| ← Oeste | S0,0 (borde) | -2 | 8.34 | 5.51 |

max = 8.3449 = V*(S0,0). En los 74 estados no terminales el residual máximo |V*(s) − max_a Q*(s,a)| es **0.00e+0**.

### Paso 9 · Trayectoria óptima desde la entrada

| t | s_t | a_t | s_t+1 | r_t+1 | γ^t | γ^t·r | G acumulada | V*(s_t) |
|---:|---|---|---|---:|---:|---:|---:|---:|
| 0 | S0,0 | ↑ Norte | S0,1 | -1 | 1.0000 | -1.0000 | -1.0000 | 8.3449 |
| 1 | S0,1 | → Este | S1,1 | -1 | 0.9000 | -0.9000 | -1.9000 | 10.3832 |
| 2 | S1,1 | → Este | S2,1 | -1 | 0.8100 | -0.8100 | -2.7100 | 12.6480 |
| 3 | S2,1 | → Este | S3,1 | -1 | 0.7290 | -0.7290 | -3.4390 | 15.1645 |
| 4 | S3,1 | → Este | S4,1 | -1 | 0.6561 | -0.6561 | -4.0951 | 17.9605 |
| 5 | S4,1 | → Este | S5,1 | -1 | 0.5905 | -0.5905 | -4.6856 | 21.0672 |
| 6 | S5,1 | → Este | S6,1 | -1 | 0.5314 | -0.5314 | -5.2170 | 24.5192 |
| 7 | S6,1 | → Este | S7,1 | -1 | 0.4783 | -0.4783 | -5.6953 | 28.3546 |
| 8 | S7,1 | ↑ Norte | S7,2 | -1 | 0.4305 | -0.4305 | -6.1258 | 32.6163 |
| 9 | S7,2 | ↑ Norte | S7,3 | -1 | 0.3874 | -0.3874 | -6.5132 | 37.3514 |
| 10 | S7,3 | → Este | S8,3 | -1 | 0.3487 | -0.3487 | -6.8619 | 42.6127 |
| 11 | S8,3 | ↑ Norte | S8,4 | -1 | 0.3138 | -0.3138 | -7.1757 | 48.4585 |
| 12 | S8,4 | ↑ Norte | S8,5 | -1 | 0.2824 | -0.2824 | -7.4581 | 54.9539 |
| 13 | S8,5 | → Este | S9,5 | -1 | 0.2542 | -0.2542 | -7.7123 | 62.1710 |
| 14 | S9,5 | ↑ Norte | S9,6 | -1 | 0.2288 | -0.2288 | -7.9411 | 70.1900 |
| 15 | S9,6 | ↑ Norte | S9,7 | -1 | 0.2059 | -0.2059 | -8.1470 | 79.1000 |
| 16 | S9,7 | ↑ Norte | S9,8 | -1 | 0.1853 | -0.1853 | -8.3323 | 89.0000 |
| 17 | S9,8 | ↑ Norte | S9,9 | 100 | 0.1668 | 16.6772 | 8.3449 | 100.0000 |

G₀ = Σ γ^t·r_t+1 = **8.3449 = V*(S0,0)**: la suma descontada de la trayectoria coincide con el valor que calculó Bellman.

### Paso 10 · Interpretación: fórmula cerrada

Como el MDP es determinista y cada paso cuesta lo mismo, V* sólo depende de d(s), los pasos de la ruta segura más corta al oro: V*(s) = Σ_{t=0}^{d−2} γ^t·(−1) + γ^(d−1)·100 = **−10 + 110·0.9^(d−1)**. Es decreciente en d, así que π* es la ruta segura más corta. Error máximo frente a la iteración de valores: 1.4e-14.

| d | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| V*(d) | 100.00 | 89.00 | 79.10 | 70.19 | 62.17 | 54.95 | 48.46 | 42.61 | 37.35 | 32.62 | 28.35 | 24.52 | 21.07 | 17.96 | 15.16 | 12.65 | 10.38 | 8.34 | 6.51 | 4.86 | 3.37 | 2.04 | 0.83 | -0.25 | -1.23 | -2.10 |
| # estados | 2 | 3 | 2 | 2 | 4 | 5 | 6 | 6 | 8 | 4 | 3 | 1 | 2 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 2 | 3 | 1 | 1 | 2 | 1 |


## Los otros escenarios

### Nivel 2 · Ride the Lightning (1984)

Semilla 1109 · peligros: sillas eléctricas 🕳️ y Creeping Death 👹 · ruta óptima de **20 pasos** · converge en **K = 29** iteraciones (d_max = 28) · **V*(S0,0) = 4.8594** = −10 + 110·0.9^19 = 4.8594.

π*:

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | → | → | → | ↓→ | ↓ | 🕳️ | → | → | → | 🏆 |
| **8** | 🕳️ | ↑ | 🕳️ | → | → | → | ↑→ | ↑ | 👹 | ↑ |
| **7** | → | ↑ | ← | 👹 | ↑→ | ↑ | 🕳️ | 🕳️ | ↓ | 🕳️ |
| **6** | 🕳️ | ↑ | 🕳️ | ↓ | 🕳️ | 👹 | ↓→ | ↓→ | ↓ | ← |
| **5** | → | ↑ | 🕳️ | ↓ | ↓← | 🕳️ | → | → | ↓ | 🕳️ |
| **4** | ↑→ | ↑ | ← | ← | ← | ← | 🕳️ | 🕳️ | ↓ | 🕳️ |
| **3** | ↑→ | ↑ | ↑← | 🕳️ | ↑ | ↑← | ← | ← | ← | 👹 |
| **2** | 👹 | ↑ | ↑← | ← | ↑← | ↑← | 🕳️ | ↑ | ↑← | ← |
| **1** | → | ↑ | ↑← | ↑← | 🕳️ | ↑ | ← | 🕳️ | ↑ | 🕳️ |
| **0** | ↑→ | ↑ | ↑← | ↑← | ← | ↑← | ↑← | ← | ↑← | ← |

Trayectoria: S0,0 → S0,1 → S1,1 → S1,2 → S1,3 → S1,4 → S1,5 → S1,6 → S1,7 → S1,8 → S1,9 → S2,9 → S3,9 → S3,8 → S4,8 → S5,8 → S6,8 → S6,9 → S7,9 → S8,9 → S9,9

### Nivel 3 · Master of Puppets (1986)

Semilla 6942 · peligros: tumbas abiertas 🕳️ y El Titiritero 👹 · ruta óptima de **22 pasos** · converge en **K = 27** iteraciones (d_max = 26) · **V*(S0,0) = 2.0361** = −10 + 110·0.9^21 = 2.0361.

π*:

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | ↓→ | ↓→ | ↓ | 🕳️ | 🕳️ | → | → | → | → | 🏆 |
| **8** | ↓→ | → | ↓→ | ↓→ | ↓ | 🕳️ | ↑→ | ↑→ | ↑→ | ↑ |
| **7** | ↓ | 👹 | ↓→ | ↓→ | ↓→ | ↓ | 👹 | ↑→ | ↑→ | ↑ |
| **6** | → | → | → | → | ↓→ | ↓ | 🕳️ | ↑→ | ↑→ | ↑ |
| **5** | ↑→ | ↑→ | ↑ | 🕳️ | → | → | → | ↑→ | ↑ | 🕳️ |
| **4** | 🕳️ | ↑→ | ↑ | 🕳️ | ↑→ | ↑→ | ↑→ | ↑→ | ↑ | ← |
| **3** | 🕳️ | ↑→ | ↑ | ← | 👹 | 🕳️ | 🕳️ | 🕳️ | ↑ | ↑← |
| **2** | 🕳️ | 🕳️ | ↑ | ↑← | 🕳️ | ↓ | ↓← | ↓← | 🕳️ | 👹 |
| **1** | ↓→ | ↓ | 🕳️ | ↑ | ← | ← | ← | ← | 🕳️ | ↓ |
| **0** | → | → | → | ↑ | 👹 | 🕳️ | 🕳️ | ↑ | ← | ← |

Trayectoria: S0,0 → S1,0 → S2,0 → S3,0 → S3,1 → S3,2 → S3,3 → S2,3 → S2,4 → S2,5 → S2,6 → S3,6 → S4,6 → S4,5 → S5,5 → S6,5 → S7,5 → S7,6 → S7,7 → S7,8 → S7,9 → S8,9 → S9,9

### Nivel 4 · ...And Justice for All (1988)

Semilla 21491 · peligros: minas terrestres 🕳️ y La Justicia rota 👹 · ruta óptima de **24 pasos** · converge en **K = 31** iteraciones (d_max = 30) · **V*(S0,0) = -0.2508** = −10 + 110·0.9^23 = -0.2508.

π*:

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | ↓→ | ↓ | ↓← | ↓← | 👹 | → | → | → | → | 🏆 |
| **8** | ↓→ | ↓ | ↓← | ↓← | 🕳️ | ↑ | 🕳️ | ↑ | 👹 | ↑ |
| **7** | ↓→ | ↓ | ← | ← | 🕳️ | 🕳️ | → | ↑ | ← | 🕳️ |
| **6** | → | ↓ | 🕳️ | ↑ | 👹 | → | ↑→ | ↑ | ↑← | ← |
| **5** | 🕳️ | ↓ | ← | 👹 | 👹 | ↑→ | ↑→ | ↑ | ↑← | ↑← |
| **4** | ↓→ | ↓ | 🕳️ | 🕳️ | → | ↑→ | ↑→ | ↑ | ↑← | 🕳️ |
| **3** | ↓→ | ↓→ | ↓→ | ↓ | 🕳️ | ↑→ | ↑→ | ↑ | ↑← | ← |
| **2** | → | → | → | → | ↓ | 🕳️ | 🕳️ | ↑ | ↑← | ↑← |
| **1** | ↑→ | ↑ | 🕳️ | 🕳️ | → | → | ↓ | 🕳️ | ↑ | 🕳️ |
| **0** | ↑→ | ↑ | ← | 🕳️ | 🕳️ | 🕳️ | → | → | ↑ | ← |

Trayectoria: S0,0 → S0,1 → S0,2 → S1,2 → S2,2 → S3,2 → S4,2 → S4,1 → S5,1 → S6,1 → S6,0 → S7,0 → S8,0 → S8,1 → S8,2 → S8,3 → S8,4 → S8,5 → S8,6 → S8,7 → S7,7 → S7,8 → S7,9 → S8,9 → S9,9

### Nivel 5 · Metallica (The Black Album) (1991)

Semilla 13782 · peligros: agujeros negros 🕳️ y La Serpiente 👹 · ruta óptima de **26 pasos** · converge en **K = 31** iteraciones (d_max = 30) · **V*(S0,0) = -2.1031** = −10 + 110·0.9^25 = -2.1031.

π*:

| y \ x | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **9** | → | → | → | → | ↓ | ← | ← | 👹 | → | 🏆 |
| **8** | ↑→ | ↑→ | ↑ | 🕳️ | ↓ | 🕳️ | 🕳️ | → | ↑→ | ↑ |
| **7** | ↑→ | ↑ | 🕳️ | ↓→ | ↓ | 🕳️ | → | ↑ | 👹 | 🕳️ |
| **6** | ↑→ | ↑ | 🕳️ | ↓→ | ↓ | 🕳️ | ↑→ | ↑ | 🕳️ | ↓ |
| **5** | ↑ | 🕳️ | → | → | → | → | ↑→ | ↑ | ← | ← |
| **4** | ↑ | 🕳️ | ↑→ | ↑ | 🕳️ | ↑→ | ↑→ | ↑ | ↑← | ↑← |
| **3** | ↑ | 🕳️ | 🕳️ | 🕳️ | → | ↑→ | ↑ | 🕳️ | ↑ | 🕳️ |
| **2** | ↑ | ← | ← | 👹 | 👹 | ↑→ | ↑ | 👹 | 🕳️ | ↓ |
| **1** | ↑ | ↑← | ↑← | ← | 🕳️ | ↑→ | ↑ | ← | ← | ← |
| **0** | ↑ | ↑← | ↑← | ↑← | ← | 🕳️ | ↑ | ↑← | ↑← | ↑← |

Trayectoria: S0,0 → S0,1 → S0,2 → S0,3 → S0,4 → S0,5 → S0,6 → S0,7 → S0,8 → S0,9 → S1,9 → S2,9 → S3,9 → S4,9 → S4,8 → S4,7 → S4,6 → S4,5 → S5,5 → S6,5 → S6,6 → S6,7 → S7,7 → S7,8 → S8,8 → S8,9 → S9,9


## Conclusiones

1. La iteración de valores aplica la Ecuación de Optimalidad de Bellman como regla de actualización y converge a V\* en pocas decenas de barridos (ΔV < ε).
2. El valor del oro se propaga desde S9,9 como una onda, **una celda por iteración**, descontado por γ y penalizado por el costo de vida; por eso ΔV_k = 100·γ^(k−1) mientras la onda avanza y K = d_max + 1.
3. La política óptima evita los 25 estados terminales negativos y las fronteras, y elige la ruta segura más corta: V\*(s) = −10 + 110·0.9^(d(s)−1).
4. Cuando la ruta es larga (d ≥ 24) V\*(S0,0) llega a ser negativo, pero ir al oro sigue siendo óptimo: vagar para siempre vale −10 y caer en un peligro −100.
5. V\* coincide con la ganancia descontada G₀ = Σ γ^t·r_t+1 de la trayectoria óptima, como dicta su definición V(s) = E[G_t | S_t = s].
