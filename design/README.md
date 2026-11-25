# Design-Tokens

`tokens.json` beschreibt Farben, Schrift, Radien, Abstände und Schatten des Intranets im Format der W3C Design Tokens (DTCG). Damit lassen sich Werkzeuge wie Figma (Tokens Studio) oder Style Dictionary füttern.

- **Quelle:** Die Werte stammen aus `src/app.css`. Ändert sich dort etwas, wird `tokens.json` im selben Pull Request nachgezogen.
- **Hell und dunkel:** Farben stehen getrennt unter `farbe.hell` und `farbe.dunkel`.
- **Akzent je Mandant:** `akzent`, `fuellung` und `toenung` sind die Standardwerte. Jeder Mandant kann in der Verwaltung einen eigenen Akzent setzen; `toenung` ist immer 15 % Akzent auf der Fläche.
- **Barrierefreiheit:** Text- und Akzentfarben erfüllen WCAG 2.2 AA auf `flaeche` und `hintergrund`; Knöpfe und Eingaben sind mindestens 44 px hoch.
