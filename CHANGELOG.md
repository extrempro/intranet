# Neu im Intranet

Was sich im Intranet geändert hat, für alle verständlich. Der neueste Eintrag steht oben.

<!--
Pflege: Jeder Pull Request mit sichtbaren Änderungen erhöht die Version in
package.json und bekommt hier einen Eintrag. Überschrift genau so:
„## <Version> · <TT.MM.JJJJ> · <kurzer Titel>“. Darunter Stichpunkte in
einfacher Sprache, ohne Technik. Nach dem Merge legt GitHub Actions dazu ein
Release mit Tag v<Version> an (.github/workflows/release.yml).
-->

## 0.29.0 · 22.11.2026 · Vorschlag gleich beim Hochladen

- Beim Hochladen eines Videos ist „Zusammenfassung und Kapitel gleich vorschlagen“ voreingestellt. Der Vorschlag liegt dann bereit, sobald das Video umgewandelt ist.
- Ein solcher Vorschlag beruht auf den noch ungeprüften Untertiteln und ist so gekennzeichnet. Nach dem Korrigieren holst du dir mit „Neu vorschlagen“ einen frischen.

## 0.28.0 · 22.11.2026 · Vorschläge für Zusammenfassung und Kapitel

- Beim Bearbeiten eines Videos kannst du dir aus den geprüften Untertiteln eine kurze Zusammenfassung und Kapitel vorschlagen lassen.
- Das Sprachmodell läuft auf dem eigenen Server, der Text verlässt das Intranet nicht. Wenn der Vorschlag fertig ist, bekommst du eine Nachricht.
- Übernommen wird nur, was du bestätigst: „Als Beschreibung übernehmen“ und „Kapitel übernehmen“. Vorhandenes wird erst nach Nachfrage ersetzt.

## 0.27.0 · 22.11.2026 · Hub-Seite mit Reitern

- Jeder Hub hat jetzt Reiter: Überblick, Neues, Termine, Dokumente, Videos, Fragen sowie Über uns & Team. Jeder Reiter hat eine eigene Adresse, die du teilen kannst.
- Der Überblick zeigt Schnellzugriff, die nächsten Termine, häufige Fragen und die neuesten Beiträge. Daneben findest du, wen du ansprechen kannst.
- Leere Bereiche werden ausgeblendet. Kommst du über einen Link auf eine leere Seite, siehst du einen Hinweis.
- Fürs Hub-Team: Leere Reiter sind mit „leer“ markiert und lassen sich direkt füllen. Unter „Aufbau der Seite“ legst du die Reihenfolge der Reiter und die Blöcke im Überblick fest.

## 0.26.1 · 22.11.2026 · Schnellzugriff im Hub

- Lange Titel und Beschreibungen im Schnellzugriff bleiben jetzt in ihren Kästen. Längere Beschreibungen werden nach drei Zeilen gekürzt, der ganze Text erscheint beim Darüberfahren.

## 0.26.0 · 22.11.2026 · Konten ausblenden

- In der Verwaltung lassen sich Konten für andere ausblenden, etwa Test- oder Funktionskonten. Sie erscheinen dann nicht mehr in der Personenliste, in der Suche, in Teams und bei Zuständigkeiten.
- Anmelden und Rechte bleiben unverändert. In der Benutzerliste sind solche Konten als „ausgeblendet“ markiert.

## 0.25.0 · 22.11.2026 · Ruhezeiten je Tag und Abwesenheit

- Ruhezeiten stellst du jetzt für jeden Wochentag einzeln ein: Zeitraum, ganztägig oder keine Ruhe. Ein Satz darunter sagt, was gerade gilt.
- Neu: Abwesenheit, etwa für den Urlaub. In dieser Zeit kommen keine Push- und Teams-Nachrichten und keine E-Mails, danach alles gesammelt. Ob dringende Meldungen trotzdem kommen, entscheidest du selbst.
- Die Abwesenheit sieht niemand außer dir.

## 0.24.0 · 22.11.2026 · Mediathek übersichtlicher

- Im Player gibt es einen Knopf, um die Untertitel ein- und auszuschalten. Der Browser merkt sich die Wahl.
- Videos ohne Sprache, etwa mit nur Musik, lassen sich ohne Untertitel veröffentlichen, wenn du den Grund angibst.
- Die Seite zum Bearbeiten ist neu geordnet: links das Video und ein Überblick, wer es sieht und was noch fehlt, rechts die Schritte von den Angaben bis zum Veröffentlichen.
- In der Mediathek stehen noch nicht veröffentlichte Videos getrennt unter „In Arbeit und Entwürfe“, mit dem Hinweis, wer sie sehen kann.

## 0.23.1 · 22.11.2026 · Rückmeldungen immer im Blick

- Meldungen wie „Gespeichert.“ oder Fehler erscheinen zusätzlich unten im Fenster, wenn sie auf einer langen Seite gerade nicht zu sehen sind, auf PC, Tablet und Handy.
- Ein Klick auf die Meldung springt an die Stelle, zu der sie gehört.

## 0.23.0 · 22.11.2026 · Untertitel automatisch

- Videos bekommen beim Hochladen automatisch deutsche Untertitel. Die Spracherkennung läuft auf dem eigenen Server, nichts geht an einen Cloud-Dienst.
- Automatische Untertitel lassen sich Zeile für Zeile korrigieren. Veröffentlicht wird erst, wenn jemand sie als geprüft markiert hat.
- Zu jedem Video kann es eine Textfassung zum Nachlesen und Anhänge geben, etwa Unterlagen zur Schulung.
- Bricht das Hochladen ab, geht es mit derselben Datei an der gleichen Stelle weiter.
- Ein Video lässt sich durch eine neue Fassung ersetzen. Bis sie fertig ist, bleibt das bisherige online.

## 0.22.0 · 22.11.2026 · Weiter, wo du warst

- Videos starten dort, wo du aufgehört hast, auch auf einem anderen Gerät. Mit „Von vorn beginnen“ geht es wieder am Anfang los.
- Angefangene Videos stehen oben in der Mediathek unter „Weiter ansehen“.
- Gespeichert wird nur die Stelle im Video. Niemand sonst sieht sie, und am Ende des Videos oder nach 90 Tagen wird sie gelöscht.
- Unter Konto → Mediathek kannst du das ausschalten oder deinen Fortschritt löschen.

## 0.21.0 · 22.11.2026 · Mediathek

- Neu unter Wissen: die Mediathek mit Videos aus den Abteilungen und Hubs, etwa Schulungen und Anleitungen. Durchsuchbar nach Titel, Beschreibung und dem, was in den Untertiteln gesagt wird.
- Wer in einer Einheit das neue Recht „Mediathek“ hat, lädt Videos hoch, ergänzt Untertitel und Kapitel und veröffentlicht sie.
- Videos haben Kapitel zum Springen, Untertitel, ±10 Sekunden und eine einstellbare Geschwindigkeit. Die Qualität passt sich der Verbindung an.
- Auf den Seiten der Abteilungen und Hubs gibt es einen Abschnitt „Videos“.
- FAQs bekommen Themen aus derselben Liste wie die Videos und lassen sich danach filtern. Fehlt ein Thema, kannst du es vorschlagen.
- Niemand sieht, wer welches Video angeschaut hat.

## 0.20.0 · 22.11.2026 · Speicherorte für Dateien

- System-Admins legen unter Verwaltung → Speicher fest, wo die Dateien des Intranets liegen: auf dem Server oder in einem S3-Speicher.
- Für jede Art von Dateien, etwa Anhänge, Pläne oder Profilfotos, lässt sich der Speicherort einzeln wählen.
- Vorhandene Dateien ziehen auf Wunsch im Hintergrund um. Jede Datei wird geprüft, bevor sie am alten Ort gelöscht wird.
- Alle Dateien bleiben verschlüsselt, egal wo sie liegen.

## 0.19.2 · 22.11.2026 · Allgemeine Beispiele

- Die Beispiele in Eingabefeldern, etwa bei Domains und Gruppennamen, sind jetzt allgemein gehalten.

## 0.19.1 · 21.11.2026 · Besser zugänglich

- Bildschirmleser lesen beim Logo und beim Kontomenü jetzt denselben Namen vor, den du siehst.
- Die Hinweise im Kopf eines Hubs haben mehr Kontrast und sind besser lesbar.
- Die Liste „Wer darf schreiben?“ beim Bearbeiten eines Hubs ist für Bildschirmleser richtig aufgebaut.

## 0.19.0 · 21.11.2026 · Hub bearbeiten auf einer Seite

- „Bearbeiten“ eines Hubs ist jetzt eine Seite mit einem „Speichern“ am Ende, so wie im Entwurf.
- Personen wählst du über „Person suchen“ aus: Namen tippen, Vorschlag anklicken. Das gilt für Schreibrechte, Ansprechpersonen und das Hub-Team.
- Schreibrechte schaltest du je Person als Knöpfe ein und aus: Neuigkeiten, FAQs, Termine, Dokumente.
- Beim Schnellzugriff wählst du mit „Ziel wählen“ eine Seite im Intranet, ein Dokument des Hubs oder eine Adresse.
- Termine des Hubs trägst du direkt auf der Seite ein; sie stehen auch im Kalender.
- Im Hub-Team legst du je Person eine Aufgabe fest und schaltest die Koordination um.

## 0.18.0 · 21.11.2026 · Hubs ausgebaut

- Neuer Kopf der Hub-Seite mit Kurzinfo, Glocke, Stern für die Favoriten, Link kopieren und dem Hub-Team auf einen Blick; auf Wunsch mit Titelbild und Symbol.
- Neue Abschnitte: Schnellzugriff als Kacheln, Neues zum Thema mit Vorschaubild, Termine mit „In Kalender“, Dokumente und Anleitungen in Ordnern, Hub-Team mit Aufgaben und Koordination, Ansprechpersonen und häufige Fragen.
- Der Hinweis oben kann ein Enddatum bekommen und verschwindet danach von selbst.
- Das Hub-Team pflegt seinen Hub selbst: weitere Personen ins Team holen, Schreibrechte vergeben (auch für Dokumente), Seitenaufbau einstellen. Auch die Verwaltung kann einen Hub pflegen.
- Bei Hubs für alle Mandanten können Personen aller Mandanten mitmachen.
- Die Hub-Liste hat eine Suche und einen Filter nach Mandant.

## 0.17.1 · 21.11.2026 · Entwurf-Knopf neben Speichern

- „Als Entwurf speichern“ steht jetzt direkt neben „Speichern“ bzw. „Veröffentlichen“; darunter steht, wann der Entwurf zuletzt gespeichert wurde.

## 0.17.0 · 21.11.2026 · Entwürfe und Schutz vor Datenverlust

- Neue Neuigkeiten, Hub-Beiträge, Beiträge „Hinter den Kulissen“ und FAQs werden beim Schreiben automatisch als Entwurf gespeichert. Mit „Als Entwurf speichern“ geht es auch sofort.
- Entwürfe siehst nur du. Du findest sie unter „Meine Entwürfe“ im Kontomenü und oben auf der Seite zum Erstellen, auf jedem Gerät und in Teams.
- Verlässt du eine Seite mit ungespeicherten Eingaben, fragt das Intranet vorher nach, ob du wirklich gehen willst.

## 0.16.0 · 21.11.2026 · Bilder ziehen und klarere Symbole

- Bilder im Text ziehst du jetzt am Anfasser an der Ecke größer oder kleiner. Alternativ geht es in der Leiste mit „−“ und „+“ in 5-%-Schritten.
- Bilder lassen sich mit der Maus an eine andere Stelle im Text ziehen.
- Die Werkzeugleiste des Editors hat einheitliche, gut erkennbare Symbole.
- Nach dem Einfügen eines Bildes schreibst du direkt dahinter weiter.
- Hinweise wie „Neu in Version …“ oder „Neu laden“ haben jetzt Abstand zum Inhalt darunter.

## 0.15.0 · 21.11.2026 · Tabellen, Infokästen und Unterstreichen

- Im Editor kannst du jetzt Text unterstreichen.
- Neu sind einfache Tabellen mit Kopfzeile. Zeilen und Spalten fügst du über eine eigene Leiste hinzu oder löschst sie. Am Handy lassen sich breite Tabellen seitlich verschieben.
- Mit dem Infokasten hebst du Wichtiges hervor, wahlweise als Info, Hinweis oder Warnung.
- Das gibt es bei Neuigkeiten, Hub-Beiträgen, „Hinter den Kulissen“ und FAQs.

## 0.14.0 · 21.11.2026 · Bilder im Text

- Bilder lassen sich jetzt direkt in den Text setzen: über 🖼 im Editor, per Hineinziehen oder Einfügen. Das geht bei Neuigkeiten, Hub-Beiträgen, „Hinter den Kulissen“ und FAQs.
- Du wählst die Größe (klein, mittel, volle Breite) und ob das Bild links oder rechts steht; der Text fließt daneben weiter. Am Handy sind Bilder immer so breit wie der Text.
- Jedes Bild braucht eine kurze Bildbeschreibung, damit auch Bildschirmleser wissen, was zu sehen ist.
- JPEG, PNG und WebP sind erlaubt, große Bilder werden automatisch verkleinert. Animierte WebP stehen zuerst still und starten mit „Abspielen“.

## 0.13.2 · 21.11.2026 · Feinschliff bei Abständen

- Aufklapplisten wie „Mehr“ oder „Aus: dein Mandant“ bleiben jetzt im Bild und laufen nicht mehr über den rechten Rand.
- Am Handy steht oben nur noch das Logo statt eines abgeschnittenen Titels.
- Das Protokoll ist am Handy gut lesbar: jeder Eintrag als Block statt einer zu schmalen Tabelle.
- Fehlende Leerzeichen vor „·“ ergänzt, zum Beispiel „lokal · 3 Rollen“.

## 0.13.1 · 21.11.2026 · Rückfragen als eigenes Fenster

- Bevor etwas gelöscht, gesperrt oder entzogen wird, fragt das Intranet jetzt in einem eigenen Fenster nach. Am Handy kommt es von unten, mit großen Knöpfen.
- Auch beim Abmelden anderer Geräte, beim Entfernen aus einem Team, beim Sperren des Kalender-Links und beim Zurücksetzen der Startseite fragt das Intranet jetzt vorher nach.

## 0.13.0 · 21.11.2026 · Fehler melden mit Bildschirmfoto

- „Rückmeldung geben“ (Daumen oben rechts) öffnet jetzt ein Fenster direkt über der Seite, auf der du bist.
- Bei einem Fehler kannst du ein Bildschirmfoto mitschicken: am PC direkt aufnehmen, ein Bild auswählen oder mit Strg + V einfügen. Du siehst es vor dem Senden und kannst es wieder entfernen.
- Damit die IT den Fehler nachstellen kann, gehen ein paar technische Angaben mit, zum Beispiel Version und Browser. Was genau, siehst du vor dem Senden.
- Fehlermeldungen liest jetzt die IT, Ideen weiter die Verwaltung deines Mandanten. Das Bildschirmfoto wird 30 Tage nach Abschluss gelöscht.

## 0.12.1 · 21.11.2026 · Menü und Rückmeldung

- Im Menü kannst du jetzt jeden Bereich auf- und zuklappen, auch den, in dem du gerade bist. Mehrere Bereiche können gleichzeitig offen sein.
- „Rückmeldung geben“ oben rechts hat ein neues Symbol: Daumen hoch und Daumen runter.

## 0.12.0 · 21.11.2026 · Aufklappbares Menü

- Am PC und Tablet lassen sich die Bereiche im Menü links auf- und zuklappen, sodass du alle Unterseiten auf einen Blick siehst.
- Das ganze Menü lässt sich auf schmale Symbole zusammenklappen. Ein Klick auf ein Symbol zeigt die Unterseiten daneben. Auf dem Tablet ist es anfangs zusammengeklappt.
- Das Intranet merkt sich deine Einstellung auf jedem Gerät.
- Datenschutz und Impressum öffnen sich in einem neuen Fenster.

## 0.11.2 · 21.11.2026 · Symbol in der Teams-Leiste

- Das kleine Symbol der Intranet-App links in der Teams-Leiste wird jetzt vollständig angezeigt, auch mit feinen Linien.

## 0.11.1 · 21.11.2026 · Aufgeräumtes Menü

- Im Menü oben rechts gibt es nur noch **Mein Konto**. Dort stehen auch Profilfoto und Kontaktdaten.
- „Neu im Intranet“, Datenschutz und Impressum sind jetzt kleine Symbole unten im Hauptmenü. Auf dem Handy findest du sie ganz unten unter „Konto“.

## 0.11.0 · 21.11.2026 · Hinweis auf neue Versionen

- Gibt es eine neue Version des Intranets, während du es offen hast, erscheint oben der Hinweis „Neu laden“. Das gilt im Browser und in der Teams-App. Beim nächsten Klick auf einen Link bekommst du die neue Version ohnehin.
- Nach einem Update zeigt das Intranet einmal kurz, was neu ist. Unter Konto → Weitere Einstellungen kannst du das abschalten.

## 0.10.1 · 21.11.2026 · Teams-App ohne Test-Reiter

- Die Teams-App hat keinen Reiter „Test“ mehr.

## 0.10.0 · 21.11.2026 · Bildbeschreibungen

- Wer Bilder hochlädt, kann jetzt kurz beschreiben, was darauf zu sehen ist. Bildschirmleser lesen die Beschreibung vor. Das geht in Beiträgen, „Hinter den Kulissen“ und am Schwarzen Brett.

## 0.9.0 · 21.11.2026 · Barrierefreiheit

- Fehlerseiten erklären auf Deutsch, was los ist, und führen zurück zur Startseite.
- In der dunklen Darstellung sind rote Hinweise und Knöpfe jetzt gut lesbar.
- Auf kleinen Bildschirmen und bei starker Vergrößerung steht nichts mehr seitlich über.
- Links und Knöpfe sind leichter zu treffen, PDF-Vorschau und lange Tabellen lassen sich per Tastatur scrollen.
- Neue Tipps im Handbuch, wie Beiträge für alle lesbar werden.

## 0.8.1 · 21.11.2026 · Aufgeräumt

- Der Hinweis zum E-Mail-Versand bei den Betreiber-Konten zeigt jetzt, wo er sich einrichten lässt.
- Kleinere Aufräumarbeiten im Hintergrund.

## 0.8.0 · 21.11.2026 · Einrichtung ohne Microsoft

- Ein neu aufgesetztes Intranet wird über einen einmaligen Link eingerichtet: Hauptmandant anlegen und den ersten Admin mit eigenem Passwort und zweitem Faktor.
- Für Notfälle kann die IT auf dem Server einen weiteren Admin-Zugang erzeugen.
- Wer System-Admin ist, legt jetzt nur noch das Intranet selbst fest, nicht mehr eine Gruppe in Microsoft.

## 0.7.0 · 21.11.2026 · Startklar-Prüfung

- Unter Verwaltung → System zeigt „Startklar“ auf einen Blick, ob alles für den Betrieb eingerichtet ist: Adresse, Microsoft-Anmeldung, Notfallzugang, E-Mail, Sicherung, Datenschutz und Impressum, Teams und Datenbank.

## 0.6.0 · 21.11.2026 · Erneute Anmeldung in der Verwaltung

- Wer Rollen vergibt, Konten sperrt oder Einstellungen zur Anmeldung und zum E-Mail-Versand ändert, bestätigt vorher noch einmal die eigene Anmeldung. Danach geht es 10 Minuten ohne erneute Nachfrage.
- Die Teams-App ist gegen Missbrauch von Links besser geschützt.

## 0.5.0 · 21.11.2026 · Eigenes Aussehen für die Teams-App

- Die Teams-App zeigt jetzt Symbol und Farbe des Hauses.
- Die IT kann Name, Beschreibung, Herausgeber, Farbe und Symbol der Teams-App selbst festlegen.

## 0.4.0 · 21.11.2026 · Neu im Intranet

- Unten auf jeder Seite steht jetzt die Version. Ein Klick auf „Neu im Intranet“ zeigt, was sich geändert hat.

## 0.3.0 · 21.11.2026 · Das Intranet in Teams

- Das Intranet gibt es jetzt als App in Teams. Du bist dort automatisch mit deinem Microsoft-Konto angemeldet.
- Benachrichtigungen können in Teams unter „Aktivität“ ankommen, für jedes Thema einstellbar unter Konto → Benachrichtigungen. Voreingestellt ist Teams wie Push.
- Ein Klick auf eine Teams-Meldung öffnet den Beitrag direkt in der App.
- Am PC hat das Intranet in Teams keine eigene Kopfzeile. Glocke, Nachrichten und Kontomenü stehen oben links.

## 0.2.0 · 21.11.2026 · Neue Gestaltung

- Neue Gestaltung für alle Seiten: Seitenleiste mit Suche, Pfad oben, Karten und Filter als Pillen.
- Jedes Haus hat eigene Farben, Logos für hell und dunkel und ein eigenes App-Symbol.
- Anmelden geht jetzt auch nur mit Passkey, also mit Fingerabdruck, Gesichtserkennung oder PIN des Geräts.
- Beiträge aus „Hinter den Kulissen“ zeigen mehrere Fotos als Diashow.
- Kalender: Termine zeigen, ob sie von einer Abteilung oder einem Hub kommen. Mit „Quelle“ filterst du danach.
- Pläne lassen sich drucken und offline speichern. Ist deine Offline-Fassung veraltet, siehst du das.
- Rechtliches mit Reitern und dem Filter „Neu oder geändert“.
- Das Handbuch hat links eine Themenliste.
- Meine Hubs: Lege fest, wie neue Abos benachrichtigen, und übertrage das auf alle Abos.
- Ruhezeiten stellst du mit Schaltern ein.
- Personen: Zuerst suchen oder eine Abteilung wählen, die ganze Liste auf Wunsch.
- Links zu Datenschutz und Impressum je Haus.

## 0.1.0 · 20.11.2026 · Erste Fassung

- **Aktuelles:** Neuigkeiten mit dringenden und angehefteten Beiträgen, Kalender mit Abo für dein Kalenderprogramm, Pläne des KBB, Hinter den Kulissen, Schwarzes Brett und Speiseplan.
- **Organisation:** Abteilungen mit „Wer hilft bei was?“, Hubs zum Abonnieren, Personen und Organigramm.
- **Wissen:** FAQs, Rechtliches mit Vereinbarungen, Gesetzen und Tarifverträgen, und ein Handbuch.
- **Benachrichtigungen** per Glocke, Push und E-Mail, je Thema einstellbar, mit Ruhezeiten.
- **Nachrichten** zu Anzeigen, Hub-Anträgen und Rückmeldungen.
- Als App auf Handy und PC installierbar, Pläne auch offline.
- Anmeldung mit Microsoft-Konto oder lokalem Konto mit zweitem Faktor.
